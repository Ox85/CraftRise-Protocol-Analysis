# CraftRise-Protocol-Analysis

RiseClient 1.8.9 (MCP 918 tabanlı Minecraft istemcisi) ile CraftRise oyun sunucuları
arasındaki Java tarafı ağ protokolünün tam reverse engineering çalışması. Katmanlı AES
şifreleme, obfuscated string sabitleri, genişletilmiş Minecraft handshake paketi ve özel
Netty JSON kanal protokolü — tümü bytecode analizi ve trafik yakalamayla açığa çıkarıldı.

---

### Protokol Genel Bakış

İstemci oturum başına eş zamanlı **4 TCP bağlantısı** açar:

| # | Hedef | Protokol | İşlev |
|---|-------|----------|-------|
| 1 | `185.255.92.10:4754` (kısa ömürlü) | Netty ObjectEncoder JSON | `tryLogin` isteği |
| 2 | `185.255.92.10:4754` (kalıcı) | Netty ObjectEncoder JSON | `introduction / getAvailableLobby / getHashsCrypted` polling |
| 3 | Lobby IP:4754 (kalıcı) | Netty ObjectEncoder JSON | `alive` keepalive (5 sn) |
| 4 | Lobby IP:port (kalıcı) | Minecraft 1.8 | Genişletilmiş C00Handshake + oyun trafiği |

Auth sunucusu tektir; oyun sunucuları birden fazla makinede (`185.255.92.9`, `185.255.92.10`,
`185.255.92.4`) farklı portlarda çalışır ve her `getAvailableLobby` çağrısı random / round-robin
ile farklı lobi atar.

---

### AES Anahtar Yüzeyi

İstemci içinde altı ayrı **AES/ECB/PKCS5Padding** anahtarı, her biri **16 karakter uzunluğunda**
sabit string olarak obfuscated saklanır. Deobfuscate edilmiş halleri:

| İsim | Değer | Kullanım |
|------|-------|----------|
| `DEFAULT` | `2650053489059452` | Auth key, keyValidator, lobby cevabı |
| `INNER` | `2650053419059452` | Blob iç AES katmanı |
| `OUTER` | `2650053417028341` | Blob dış AES katmanı |
| `CLIENT_MSG` | `1234758145215632` | Launcher IPC |
| `NAMEHASH` | `2650053489028332` | Blob içindeki `nameHash` alanı |
| `SESSION` | `2650053406013170` | `val2` hash öncesi blob şifresi |

Tüm anahtarlar 16 haneli ASCII rakam string'i — key material olarak ham byte değil, ASCII
representation ile besleniyor.

---

### tryLogin Hash Zinciri

Auth isteği tek başına birkaç hash türetir; hepsi MD5 tabanlı, her biri farklı bir salt ile:

```
key      = b64( AES( DEFAULT, AES( DEFAULT, b64( user + "###" + md5(pass) + "###" + millis ) ) ) )
sum      = md5( key )
sumBig   = md5( sum + user + "....." )        ← 5 nokta
sumBigX  = md5( "......" + sumBig + "......" ) ← 6 nokta, iki yanda
sumBigY  = md5( "craftrise#" + user )
```

Cevaptaki `keyValidator` alanı **beş katmanlı** çözülüyor:
`AES_DECRYPT(DEFAULT) → b64 → AES_DECRYPT(DEFAULT) → AES_DECRYPT(DEFAULT) → b64` ve sonunda
`<user>###<uuid_no_dashes>###<millis>` şablonuna dönüyor.

---

### Blob Şifreleme (8 Katman)

Handshake paketine gömülen `encBlob`, düz JSON'dan sekiz adımda üretilir. Her ok yeni bir
transformasyon:

```
plaintext_json
    → base64
    → BLOB_PREFIX + b64 + BLOB_SUFFIX      ("3ebi2mclmAM7Ao2" / "KweGTngiZOOj9d6")
    → base64
    → base64
    → AES( INNER )
    → base64
    → AES( OUTER )
    → base64  = encBlob (val1)
```

Sarmalayıcı JSON — `{"1": val1, "2": val2}` — burada **val2**'nin ne olduğu ilk bakışta
anlaşılmıyor. Doğru formül:

```
val2 = md5( base64( AES_ECB(SESSION, val1) ) )
```

Yani `val1`'in kendisi SESSION anahtarıyla tekrar AES'lenip, base64'lenip, ardından MD5
hex'i alınıyor. İlk yanlış tahmin genelde `md5(keyValidator_uuid)` oluyor.

---

### nameHash — `port + 1` Detayı

Blob içindeki `nameHash` alanı bytecode'da şu şekilde üretiliyor:

```
plaintext = username + clientHash + String.valueOf(port + 1) + serverAddress
nameHash  = base64( AES_ECB(NAMEHASH, plaintext) )
```

Kritik olan nokta: `iload_2, iconst_1, iadd` sırası — kullanılan port, blob'daki `port`
alanının **bir fazlası**. Bu detay atlanırsa nameHash sunucu tarafında invalid geliyor.
`clientHash` alanı da yüklü RiseClient JAR'ının **SHA-1**'i — decompile edilmiş versiyonunki değil.

---

### `racGuardKey` Placeholder ve Deobfuscation

Blob'a `racGuardKey` alanı önce `"%RAC_GUARD_KEY%"` literal placeholder olarak yazılıyor,
sonra `String.replaceAll` ile gerçek değerle değiştirilip şifreleme başlıyor. Gerçek değer
JAR içinde 64 elemanlı bir `long[]` dizisinde saklı:

```
long[64]
    → her element için: byte = (long - 7) / 9000
    → byte[64] → String → base64 decode → 48 byte ciphertext
    → AES_DECRYPT( DEFAULT ) → 40 byte base64 string
    → base64 decode → "QUBENZ1136ZyefHJB213BV21HABnsf" (30 byte)
```

İkiz alanlar `racGuardKey2` ve `racGuardKey3` de aynı schema ile üretilmiş sabitler:
`QUBENZ2136LyefBJB2l3BV21HABnst` ve `QUBENZ2136LyefBJB213BV2lHABnst`.

---

### String Obfuscation Şeması

`crsecond/Ͻ` sınıfındaki tüm string sabitleri runtime'da **DES/CBC/PKCS5Padding** ile
decrypt ediliyor, IV zero. Anahtar türetme zinciri:

```
f          = 98049190020208L                   (sınıfta static base)
var3       = f ^ method_xor_const              (her metodun kendi xor sabiti)
actual     = CP_LONG ^ var3                    (her invokedynamic için)
h_index    = sipush ^ (actual & 0x7FFF) ^ 22253
des_key    = actual → 8 byte big-endian
plaintext  = h[h_index] → DES_DECRYPT(des_key)
```

Sonuç: `Ͻ.h` array'inden istenen decrypted string tamamen offline çıkarılabilir; runtime'a
gerek yok.

---

### Genişletilmiş C00Handshake

Standart Minecraft 1.8 handshake'ine iki ek String alan eklenmiş:

```
VarInt(protocolVersion = 47)
String(serverAddress)      ← blob'daki serverAddress ile birebir aynı olmak zorunda
Short(port)                ← blob'daki port ile birebir aynı olmak zorunda
VarInt(nextState = 2)
String(handshakeBlob)      ← {"1":"<encBlob>","2":"<blobHash>"}
String(passwordToken)      ← base64(password)
```

Server, C00Handshake'i kabul etmek için **aynı IP'den paralel session kanallarının aktif
olmasını** bekler — blob doğru olsa bile packet channel + keepalive hazır değilse graceful
`Disconnect` dönüyor.

---

### Blob JSON Alan Kaynakları

Blob içindeki alanların hangi kaynaktan geldiği:

| Alan | Kaynak |
|------|--------|
| `"3"`, `"4"`, `"5"`, `key` | Sabit (`"0110101110"`, `"1"`, `"6"`, `"D4R3LSPR1N5S"`) |
| `serverAddress`, `port` | `getAvailableLobby` cevabından dinamik |
| `clientHash` | Yüklü JAR SHA-1'i |
| `sessionHash` | `<clinit>`'te `UUID.randomUUID()` |
| `globalSessionHash` | `tryLogin` cevabından |
| `launcherKeys` | Sabit base64 token (JAR'da hard-coded) |
| `racGuardKey*` | Yukarıda deobfuscate edilen 30 byte string'ler |
| `runtime` | `crsecond/Ǯ.ϕ()` — sadece 6 `rac-*` alanı |
| `runtimeKey` | `discordUser.userId + "###" + discordUser.username` (boş olabilir) |
| `mAd` | Nested JSON string — donanım/ağ parmak izi |
| `proxyPort` | `14828` |
| `language_id` | `711747` |

Alan sırası HashMap iteration order'a bağlı — server tarafında önemsiz.

---

### getHashsCrypted Cevabındaki İmza

`getHashsCrypted` çağrısına dönen `data` içindeki `signature` alanının sonuna literal
`whatthefuck` string'i ekleniyor:

```
{"signature":"<32_hex>whatthefuck","key":"<base64_libraries_json>"}
```

`key` alanı base64 decode edildiğinde `{"LIBRARIES":{"jar_name":"sha1", ...}}` yapısı çıkıyor —
bir library integrity manifest. `whatthefuck` son eki net bir geliştirici şakası.

---

### Kurulum

Bağımlılık yok, build adımı yok — sadece statik HTML:

```bash
git clone https://github.com/Ox85/CraftRise-Protocol-Analysis.git
cd CraftRise-Protocol-Analysis
```

`index.html` dosyasını çift tıklayın ya da yerel bir statik sunucu çalıştırın:

```bash
python -m http.server 8000
```

---

### Dosya Yapısı

```
.
├── index.html
├── README.md
└── assets/
    ├── css/style.css
    ├── js/script.js
    └── img/craftrise-logo.png
```

---

### :rose: Special Thanks

[@fantasywastaken](https://github.com/fantasywastaken) — İlk analiz ve doğrulama sürecinde
sağladığı destek ve geri bildirimler için.

---

### Uyarı

Bu proje **tamamen eğitim ve güvenlik araştırması amacıyla** yayınlanmıştır. Herhangi bir
sisteme yetkisiz erişim yasadışıdır ve kesinlikle önerilmez. Yazar, bu dokümanın
CraftRise'ın Kullanım Şartları'na aykırı bir şekilde kullanılmasından sorumlu değildir.
İçerik yalnızca protokolü anlamak isteyen araştırmacılar için hazırlanmıştır — kullanım
tamamen okuyucunun kendi sorumluluğundadır.
