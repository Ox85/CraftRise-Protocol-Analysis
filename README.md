# CraftRise Client Protokol Notları

RiseClient 1.8.9 (MCP 918 tabanlı Minecraft istemcisi) ile CraftRise sunucuları arasındaki
Java tarafı ağ protokolünün reverse engineering notları. Tek sayfalık, tam offline çalışan
bir statik dökümantasyon sitesi olarak paketlenmiştir. Amaç, protokolün nasıl işlediğini
anlamak — bir bypass, exploit veya launcher klonu üretmek değil.

---

### Neyi Belgeliyor?

- **Auth akışı** — `tryLogin` isteğinin payload'u, çok katmanlı AES + base64 sarmalayıcıları, `sumBig / sumBigX / sumBigY` hash zinciri ve `keyValidator` deşifre adımları.
- **Session katmanı** — kalıcı Netty JSON kanalı, `introduction / getAvailableLobby / getHashsCrypted / alive` mesajları ve wire format örnekleri.
- **Genişletilmiş C00Handshake** — Minecraft 1.8 handshake paketine eklenen iki ek String alan (handshakeBlob + passwordToken) ve gerçek bir byte dump.
- **Blob JSON şifreleme** — 8 adımlı iç/dış AES + base64 katman zinciri, `val2` MD5 hesabı ve tüm blob alanlarının kaynak tablosu.
- **`nameHash` algoritması** — bytecode'dan doğrulanmış `port + 1` detayı dahil.
- **`racGuardKey` deobfuscation** — 64 elemanlı `long[]` dizisinden `AES + base64` yoluyla açık değere ulaşan adımlar.
- **String obfuscation şeması** — `crsecond/Ͻ` sınıfının DES/CBC + XOR tabanlı string decrypt formülü.
- **Statik alanlar, runtime alt-objesi, `runtimeKey` formatı** — her biri kaynak koduyla eşleştirilmiş.
- **Deobfuscate edilmiş sabitler özeti** — tüm AES anahtarları, sabit token'lar ve sihirli değerler tek tablo halinde.

---

### Kurulum

Sunucuya, node.js'e, python'a **hiç gerek yok**. Tek yaptığınız `index.html` dosyasını
tarayıcıda açmak.

```bash
git clone https://github.com/<kullanici>/<repo>.git
cd <repo>
```

Ardından ya doğrudan `index.html` dosyasına çift tıklayın, ya da yerelde bir statik sunucu
çalıştırın:

```bash
# Python 3
python -m http.server 8000

# veya Node.js
npx serve .
```

Sonrasında tarayıcıdan `http://localhost:8000/` adresine gidin.

---

### Dosya Yapısı

```
.
├── index.html                     # Tüm dokümantasyon içeriği
├── README.md                      # Bu dosya
└── assets/
    ├── css/
    │   └── style.css              # Sayfa stili (dark, tek dosya)
    ├── js/
    │   └── script.js              # Arama, TOC, kopyala, scroll ilerleme
    └── img/
        └── craftrise-logo.png     # Sayfa logosu / favicon
```

---

### Bir Dil Modeliyle Kullanım

Sayfanın önemli bir tasarım hedefi, **HTML dosyasının doğrudan bir LLM'e verildiğinde
protokolün tam bağlamının çıkarılabilir olması**. Bu yüzden:

- Tüm AES anahtarları açık şekilde yazılmıştır.
- Blob'un içindeki her sabit alanın hem `sadece kaynak`ı hem de `deobfuscate edilmiş değeri`
  ayrı bir özet tablosunda toplanmıştır (**Bölüm 15**).
- Wire format (Netty ObjectEncoder ve C00Handshake) byte byte örneklerle verilmiştir.
- Java pseudo-code parçaları hazır kullanılabilir seviyede, sadece tek dosyada toplanmıştır.

Kısaca, `index.html` dosyasını sürükleyip bir dil modeline atmak protokolü tam anlamıyla
anlatmak için yeterli.

---

### Not

Belge deliberately sadece **Java katmanının notlarıyla sınırlıdır**. Doküman;

- yeni bir istemci yazımı için rehber değildir,
- bypass / cheat / exploit içermez,
- native modüller, launcher binary'leri veya başka çalışan bileşenler hakkında bilgi vermez.

Yalnızca public olarak dağıtılan istemcinin statik analizinden gelen protokol notlarıdır.

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
