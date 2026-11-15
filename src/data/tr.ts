/** Turkish overlays for the data files. Keys = object ids. Missing fields fall back to English. */
export interface HardwareTr { name?: string; mission?: string; site?: string; story: string }

export const HARDWARE_TR: Record<string, HardwareTr> = {
  // ── Moon: Surveyor ───────────────────────────────
  'surveyor-1': {
    site: 'Oceanus Procellarum',
    story: 'Ay’a yumuşak iniş yapan ilk Amerikan uzay aracı. Surveyor 1’den önce kimse Ay’ın zemininin üzerinde durmaya yetecek kadar sağlam olup olmadığını bilmiyordu; bazı bilim insanları bir iniş aracının kalın toza gömülmesinden korkuyordu. Dünya’ya 11.000’den fazla fotoğraf gönderdi.',
  },
  'surveyor-3': {
    site: 'Fırtınalar Okyanusu',
    story: 'Surveyor 3 yerleşmeden önce iki kez zıpladı, sonra küçük robot kepçesiyle toprağa hendekler kazdı. İki buçuk yıl sonra Apollo 12 astronotları yürüyerek onu ziyaret etti.',
  },
  'surveyor-5': {
    site: 'Mare Tranquillitatis',
    story: 'Surveyor 5, Ay’ın neyden yapıldığını test eden minik bir kimya laboratuvarı taşıyordu. Cevap: bazalt denen koyu renkli volkanik kaya; Dünya’daki yanardağların kayalarına çok benziyor.',
  },
  'surveyor-6': {
    site: 'Sinus Medii',
    story: 'Görev kontrol Surveyor 6’nın motorlarını ateşledi; araç yaklaşık 3 metre yükseldi ve yaklaşık 2,5 metre ötesine yeniden indi. Bu, Ay’dan bir şeyin ilk kez havalanmasıydı.',
  },
  'surveyor-7': {
    site: 'Tycho Krateri yakınında',
    story: 'Son Surveyor, düz “denizlerden” uzakta, dev Tycho Krateri’nin yakınındaki engebeli yüksek bölgelere indi. Aldığı kaya örnekleri koyu ovalardakilerden çok farklı görünüyordu.',
  },

  // ── Moon: Apollo LM ──────────────────────────────
  'a11-lm': {
    name: 'Eagle (iniş kademesi)',
    site: 'Sükûnet Üssü',
    story: 'Neil Armstrong ile Buzz Aldrin havalanırken Eagle’ın alt yarısı fırlatma rampası olarak geride kaldı. İnsanların başka bir dünyaya ilk adım attığı yer burası.',
  },
  'a12-lm': {
    name: 'Intrepid (iniş kademesi)',
    site: 'Fırtınalar Okyanusu',
    story: 'Apollo 12 tam hedefe iniş denemesi yaptı: 1967’den beri orada bekleyen robot Surveyor 3’ün yaklaşık 180 metre yakınına kondu.',
  },
  'a14-lm': {
    name: 'Antares (iniş kademesi)',
    story: 'Apollo 14, dev bir antik çarpmanın savurduğu kayaları toplamak için tepelik Fra Mauro bölgesine indi.',
  },
  'a15-lm': {
    name: 'Falcon (iniş kademesi)',
    story: 'Falcon, yüksek dağlar ile Hadley Rille adlı kıvrımlı bir kanyonun arasına indi. Ekip, Ay’dan toplanmış en eski parçalardan biri olan “Genesis Kayası”nı buldu.',
  },
  'a16-lm': {
    name: 'Orion (iniş kademesi)',
    site: 'Descartes Dağlık Bölgesi',
    story: 'Apollo 16, Ay kabuğunun en eski bölgelerinden olan parlak merkezi yüksek bölgeleri keşfetmeye gönderilen ilk görevdi.',
  },
  'a17-lm': {
    name: 'Challenger (iniş kademesi)',
    site: 'Taurus–Littrow Vadisi',
    story: 'İnsanların Ay’da durduğu son sefer. Jeolog astronot Harrison Schmitt parlak turuncu toprak buldu: antik volkanik ateş fıskiyelerinin yaptığı minik cam boncuklar.',
  },

  // ── Moon: LRV ────────────────────────────────────
  'a15-lrv': {
    name: 'Ay Aracı 1',
    story: 'Ay’daki ilk araba! Pille çalışan bu araç origami gibi katlanıp iniş aracına sığıyordu; sonra astronotların yürüyerek gidemeyeceği kadar uzağa sürmesine izin verdi.',
  },
  'a16-lrv': {
    name: 'Ay Aracı 2',
    site: 'Descartes Dağlık Bölgesi',
    story: 'Bu araç, John Young ile Charlie Duke’u tozlu yüksek bölgelerde taşıdı; lastik yerine tel örgü tekerleklerle kraterlerin üzerinden sekerek ilerledi.',
  },
  'a17-lrv': {
    name: 'Ay Aracı 3',
    site: 'Taurus–Littrow Vadisi',
    story: 'Son Ay arabası hepsinden uzağa, yaklaşık 36 km gitti. Çamurluğu kırılınca ekip onu haritalar, koli bandı ve kelepçelerle tamir etti.',
  },

  // ── Moon: retroreflectors ────────────────────────
  'a11-lrrr': {
    name: 'Lazer Aynası',
    site: 'Sükûnet Üssü',
    story: 'Işığı geldiği yere geri yansıtan 100 özel aynadan oluşan bir panel. Dünya’daki gözlemevleri ona lazer atıp yankının süresini ölçüyor.',
  },
  'a14-lrrr': {
    name: 'Lazer Aynası',
    story: 'Bir ayna paneli daha: 50 yıldan fazla sonra hâlâ elektriğe ihtiyaç duymuyor ve hâlâ çalışıyor. Bilim insanları onunla Einstein’ın kütleçekim kuramını sınıyor.',
  },
  'a15-lrrr': {
    name: 'Lazer Aynası',
    story: 'Apollo’nun en büyük ayna dizisi; 300 yansıtıcısı var. En güçlü yankıyı geri gönderdiği için Dünya’daki lazer istasyonlarının gözde hedefi.',
  },

  // ── Moon: ALSEP ──────────────────────────────────
  'a12-alsep': {
    name: 'ALSEP Bilim İstasyonu',
    site: 'Fırtınalar Okyanusu',
    story: 'Nükleer pille çalışan bir bilim istasyonu. Ekibin boş Ay Modülü yükselme kademesi bilerek Ay’a çarptırıldığında, sismometresi Ay’ın yaklaşık bir saat boyunca “çan gibi çaldığını” hissetti.',
  },
  'a14-alsep': {
    name: 'ALSEP Bilim İstasyonu',
    story: 'Bu istasyon ay depremlerini dinledi ve Güneş’ten gelip yüzeye çarpan ince parçacık akışını ölçtü.',
  },
  'a15-alsep': {
    name: 'ALSEP Bilim İstasyonu',
    story: 'Bir sismometrenin yanı sıra bu istasyon yere delik açıp Ay’ın içinden yukarı akan ısıyı ölçtü.',
  },
  'a16-alsep': {
    name: 'ALSEP Bilim İstasyonu',
    site: 'Descartes Dağlık Bölgesi',
    story: 'Ay’a yayılmış bir dinleme istasyonları ağının parçasıydı; böylece bilim insanları her ay depreminin nereden geldiğini tam olarak bulabildi.',
  },
  'a17-alsep': {
    name: 'ALSEP Bilim İstasyonu',
    site: 'Taurus–Littrow Vadisi',
    story: 'Son Apollo istasyonu kütleçekimini, Ay’ın minicik atmosferini ve yerin içindeki ısıyı ölçtü.',
  },

  // ── Mars ─────────────────────────────────────────
  'viking-1': {
    name: 'Viking 1 İniş Aracı',
    story: 'Mars’a güvenle inip işini yapan ilk uzay aracı. İnişten hemen sonra, saniyeler içinde Mars yüzeyinden ilk fotoğrafı çekti ve toprağı minik canlı izleri için test etti.',
  },
  'viking-2': {
    name: 'Viking 2 İniş Aracı',
    story: 'Viking 2, ikizinden çok daha kuzeydeki düz, kayalık bir ovaya indi. Kameraları iki Mars kışı boyunca mevsimlerin değişimini izledi.',
  },
  pathfinder: {
    name: 'Pathfinder İniş Aracı',
    story: 'Pathfinder dev hava yastıklarına sarılı halde Mars’a düştü, durana kadar yerde zıplayarak yuvarlandı. Sonra bir çiçek gibi açıldı ve küçük bir gezginin dışarı sürmesine izin verdi.',
  },
  sojourner: {
    story: 'Başka bir gezegendeki ilk tekerlekli gezgin; yaklaşık bir mikrodalga fırın büyüklüğünde. Kayadan kayaya yavaşça sürdü ve her birinin neyden yapıldığını kokladı.',
  },
  spirit: {
    mission: 'Mars Keşif Gezgini A',
    site: 'Gusev Krateri',
    story: 'Spirit, bir zamanlar göl barındırmış olabilecek dev bir krateri keşfetti. Tekerleklerinden biri bozulduğunda bile, takılan tekerleği arkasında sürükleyerek devam etti.',
  },
  opportunity: {
    mission: 'Mars Keşif Gezgini B',
    story: 'Opportunity 90 gün sürmek için yapılmıştı. 14 yıldan uzun süre devam etti ve bir maratondan daha uzun yol yaptı. Sonunda dev bir toz fırtınası, pillerini şarj eden Güneş’i kapattı.',
  },
  phoenix: {
    name: 'Phoenix İniş Aracı',
    story: 'Phoenix, Mars’ın buzlu uzak kuzeyine indi ve robot koluyla kazı yaptı. Açtığı çukurdaki beyaz parçalar birkaç gün içinde yavaşça kayboldu: su buzu doğrudan buhara dönüşüyordu.',
  },
  curiosity: {
    mission: 'Mars Bilim Laboratuvarı',
    site: 'Gale Krateri',
    story: 'Küçük bir araba büyüklüğünde bir gezgin; havada duran bir “gökyüzü vinci” tarafından iplerle yere indirildi. Gale Krateri’nin ortasındaki yüksek bir dağa tırmanıyor ve kaya katmanlarını bir tarih kitabının sayfaları gibi okuyor.',
  },
  insight: {
    name: 'InSight İniş Aracı',
    story: 'InSight sürmedi, yaşam için kazı da yapmadı: dinledi. Aşırı hassas sismometresi “Mars depremlerini” hissetti ve bilim insanlarının Mars’ın içini çekirdeğine kadar haritalamasına yardım etti.',
  },
  perseverance: {
    site: 'Jezero Krateri',
    story: 'Perseverance, Jezero Krateri’nin içindeki eski bir nehir deltasını keşfediyor. Kaya karotları alıp tüplere mühürlüyor; gelecekte bir görevin onları Dünya’ya getirmesini umuyor.',
  },
  ingenuity: {
    name: 'Ingenuity',
    site: 'Jezero Krateri',
    story: 'Perseverance’ın karnının altında Mars’a gelen minik bir helikopter. 5 kez uçması planlanmıştı; 72 kez uçtu ve sonunda hasar gören bir rotor kanadı onu bir daha uçamaz hale getirdi.',
  },
  'three-forks': {
    name: 'Three Forks Örnek Deposu',
    site: 'Jezero Krateri',
    story: 'Perseverance yere 10 mühürlü tüp bıraktı: kaya ve toprak örnekleri, biri Mars havası, biri de boş bir “tanık” tüp; bir hazine deposu gibi teker teker bıraktı. Gelecekteki bir görevin örnekleri yerden toplaması gerekirse yedek olacaklar.',
  },

  // ── Deep Space ───────────────────────────────────
  'pioneer-10': {
    site: 'Aldebaran’a doğru',
    story: 'Asteroit kuşağından geçen ilk uzay aracı ve Jüpiter’i ziyaret eden ilk araç. Yolda uzay kayalarına çarpıp parçalanıp parçalanmayacağını kimse bilmiyordu; sağ salim geçti.',
  },
  'pioneer-11': {
    site: 'Kartal takımyıldızına doğru',
    story: 'Pioneer 11 Jüpiter’in yanından kavis çizerek geçti ve sonra Satürn’ü ziyaret eden ilk uzay aracı oldu. Satürn’ün ve halkalarının yanından ilk o geçti; arkasından gelen Voyager’ların yolunu hazırladı.',
  },
  'voyager-2': {
    site: 'Yıldızlararası uzay',
    story: 'Uranüs’ü ve Neptün’ü ziyaret etmiş tek uzay aracı. Dev gezegenlere yaptığı büyük turdan sonra yoluna devam etti ve 2018’de Güneş’in balonundan çıkıp yıldızlararası uzaya girdi.',
  },
  'voyager-1': {
    site: 'Yıldızlararası uzay',
    story: 'İnsan yapımı, Dünya’dan en uzaktaki cisim. 2012’de yıldızlararası uzaya, yani yıldızlar arasındaki boşluğa ulaşan ilk uzay aracı oldu. Bugün hâlâ eve mesaj gönderiyor.',
  },
  ulysses: {
    mission: 'Ulysses (ESA/NASA)',
    site: 'Güneş çevresinde yörüngede',
    story: 'Ulysses, Güneş’in tepesinin ve altının üzerinden uçan ilk uzay aracıydı. Oraya varmak için Jüpiter’e kadar gitti ve yerçekimini sapan gibi kullanarak yolunu gezegenlerin düz şeridinden yukarı ve dışarı eğdi.',
  },
  near: {
    site: 'Eros asteroidinin üzerinde',
    story: 'NEAR, patates şeklindeki Eros asteroidinin çevresinde bir yıl döndü. İnmek için yapılmamıştı ama sonunda ekip onu yavaşça aşağı yönlendirdi ve o, bir asteroide inen ilk uzay aracı oldu.',
  },
  stardust: {
    site: 'Güneş çevresinde yörüngede',
    story: 'Stardust, Wild 2 kuyruklu yıldızının etrafındaki tozlu bulutun içinden uçtu ve minik taneleri süper hafif bir köpükle yakaladı. Örnekleri bir kapsül içinde Dünya’ya bıraktı, sonra ikinci bir kuyruklu yıldızı ziyaret etmeye gitti.',
  },
  spitzer: {
    mission: 'Spitzer Uzay Teleskobu',
    site: 'Dünya’nın arkasında',
    story: 'Spitzer evrene kızılötesiyle, yani gözlerimizin göremediği ısı ışığıyla baktı. Toz bulutlarının arasından yıldızların doğuşunu izledi ve TRAPPIST-1 yıldızının çevresinde Dünya büyüklüğünde yedi gezegen bulunmasına yardım etti.',
  },
  'deep-impact': {
    site: 'Güneş çevresinde yörüngede',
    story: '4 Temmuz 2005’te Deep Impact, Tempel 1 kuyruklu yıldızına bakır bir sonda fırlattı ve içinde ne olduğunu görmek için çarpışmayı izledi. Sonra yoluna devam edip bir başka kuyruklu yıldızı, Hartley 2’yi ziyaret etti.',
  },
  'new-horizons': {
    site: 'Kuiper Kuşağı',
    story: 'New Horizons 2015’te bize Plüton’a ilk yakın bakışı verdi ve dev, kalp şeklinde bir buz ovası buldu. Sonra, bir uzay aracının ziyaret ettiği en uzak dünya olan Arrokoth’un yanından geçti.',
  },
  dawn: {
    site: 'Ceres çevresinde yörüngede',
    story: 'Dawn, Dünya’nın ötesinde iki farklı dünyanın yörüngesine giren ilk uzay aracıydı: dev asteroit Vesta ve cüce gezegen Ceres. Öyle nazik bir iyon motoru kullanıyordu ki biraz hızlanması günler sürüyordu.',
  },
  kepler: {
    site: 'Güneş çevresinde yörüngede',
    story: 'Kepler yıldızlara baktı ve ışıklarındaki minik azalmaları, yani önlerinden geçen bir gezegenin gölgesini izledi. Binlerce gezegen buldu ve gezegenlerin her yerde olduğunu gösterdi: galaksimizde yıldızlardan daha çok gezegen var.',
  },
}

/** Photo captions, keyed by the photo file stem: '<id>' for PHOTOS[id], '<id>-2', '<id>-3'… for EXTRA_PHOTOS[id][0], [1]… (index + 2) */
export const PHOTO_TR: Record<string, string> = {
  // ── Moon ─────────────────────────────────────
  'surveyor-1': 'Surveyor 1’in Ay’daki kendi gölgesi, Ay öğleden sonrasının geç saatlerinde',
  'surveyor-3': 'Apollo 12 astronotu Pete Conrad Surveyor 3’ü ziyaret ediyor; arkada Ay Modülü Intrepid var',
  'surveyor-5': 'Surveyor 5’in ayağı Ay toprağında, kayarak durduğunda açtığı hendeğin yanında',
  'surveyor-6': 'LRO’nun yörüngeden gördüğü Surveyor 6, 18 metrelik bir gölge düşürüyor',
  'surveyor-7': 'Surveyor 7’nin Tycho Krateri yakınındaki manzarası; ufuktaki tepeler yaklaşık 13 km uzakta',
  'a11-lm': 'Ay’daki Eagle; Buzz Aldrin bilim deneylerini paketinden çıkarıyor',
  'a12-lm': 'Pete Conrad, Intrepid’in ekipman bölmesinde',
  'a14-lm': 'Fra Mauro’daki Antares, bayrak çoktan dikilmiş',
  'a15-lm': 'Hadley’deki Falcon, ilk Ay yürüyüşünün başlarında; arkada Hadley Delta',
  'a16-lm': 'Descartes’taki Orion, aracın TV kamerasından görülüyor',
  'a17-lm': 'Harrison Schmitt, Challenger, bayrak ve Ay aracıyla birlikte',
  'a15-lrv': 'James Irwin Ay aracının yanında; arkada Hadley Dağı',
  'a16-lrv': 'John Young, Ay aracının üzerindeki aletlere uzanıyor',
  'a17-lrv': 'Gene Cernan ilk Ay yürüyüşünde Ay aracını sürüyor',
  'a11-lrrr': 'Buzz Aldrin sismometrenin yanında; lazer aynası hemen ötesinde duruyor',
  'a14-lrrr': 'Apollo 14 lazer aynası, yüzeyde kurulmuş',
  'a15-lrrr': 'Bölge yörüngeden: ayna daire içine alınmış; yakınında bilim istasyonu, Falcon ve Ay aracı var',
  'a12-alsep': 'İstasyonun bir kısmı: önde sismometre, arkada merkezi istasyon',
  'a14-alsep': 'Antenli merkezi istasyon ve çevresindeki deneyler',
  'a15-alsep': 'Dave Scott, bilim istasyonu alanında Ay aracının içinde',
  'a16-alsep': 'Önde sismometre, arkada merkezi istasyon',
  'a17-alsep': 'Harrison Schmitt bir deney kuruyor; aracın TV kamerasından görülüyor',

  // ── Mars ─────────────────────────────────────
  'viking-1': 'Viking İniş Aracı 1’in üzerindeki bayrak, Mars’ta kendi kamerasıyla fotoğraflanmış',
  'viking-2': 'Viking İniş Aracı 2’nin çevresindeki zeminde kırağı',
  pathfinder: 'Pathfinder iniş aracı ve rampası (sol üstte), Sojourner’ın gözünden',
  sojourner: 'Sojourner, iniş aracından yeni yuvarlanıp çıkmış',
  spirit: 'Spirit’in oto portresi, 360° panoramadan birleştirilmiş',
  opportunity: 'Opportunity’nin ilk selfie’si, Perseverance Vadisi’nde',
  phoenix: 'Phoenix’in güvertesi, toprak örneklerini aletlerine verdikten sonra',
  curiosity: 'Curiosity’nin “Buckskin” sondaj noktasında çektiği alçak açılı selfie’si',
  insight: 'InSight’ın son selfie’si; güneş panelleri toza gömülmüş',
  perseverance: 'Perseverance’ın, yaklaşık 4 metre ötedeki Ingenuity ile selfie’si',
  ingenuity: '72. ve son uçuşundan sonra Ingenuity, hasarlı rotor kanadının gölgesini fotoğraflıyor',
  'three-forks': 'Perseverance’ın Three Forks’ta örnek tüplerle selfie’si',

  // ── Deep Space ───────────────────────────────
  'pioneer-10': 'Pioneer 10 Cape Kennedy’de hazırlanıyor; plaketi yerinde',
  'pioneer-11': 'Pioneer 11’i taşıyan bir Atlas-Centaur roketi havalanıyor, Nisan 1973',
  'voyager-2': 'Neptün, Voyager 2’nin en yakın geçişinden 4 gün önce çektiği son bütün gezegen fotoğraflarından',
  'voyager-1': '“Soluk Mavi Nokta”: Voyager 1’in 6 milyar km’den fazla uzaktan gördüğü Dünya',
  ulysses: 'Ulysses ve fırlatıcısı Uzay Mekiği Discovery’den uzaklaşıyor, 6 Ekim 1990',
  near: 'Eros’un kuzey yarısı, NEAR’ın fotoğraflarından birleştirilmiş',
  stardust: 'Stardust’ın aerojel toz toplayıcısı',
  spitzer: 'Spitzer, Cape Canaveral’da fırlatmaya hazırlanıyor, 2003',
  'deep-impact': 'Deep Impact’in çarpıcısı vurduktan 67 saniye sonra Tempel 1 kuyruklu yıldızı parlıyor',
  'new-horizons': 'Plüton, güçlendirilmiş renkte; New Horizons’ın 14 Temmuz 2015’te çektiği fotoğraf',
  dawn: 'Dawn’ın gördüğü Ceres; ortada en parlak noktasına ev sahipliği yapan Occator Krateri',
  kepler: 'Kepler, Boulder, Colorado’daki Ball Aerospace’te temiz odada',

  // ── Moon extras ──────────────────────────────
  'surveyor-1-2': 'Fırtınalar Okyanusu’nda duran Surveyor 1, LRO’nun yörüngeden görüntüsü',
  'surveyor-3-2': 'Kraterindeki Surveyor 3, ikinci Apollo 12 Ay yürüyüşünde fotoğraflanmış',
  'surveyor-3-3': 'Ay’da iki uzay aracı: önde Surveyor 3, arkada Apollo 12 Ay Modülü',
  'surveyor-5-2': '10 metrelik bir kraterin içindeki Surveyor 5, LRO’nun yörüngeden görüntüsü',
  'a11-lm-2': 'Buzz Aldrin Ay Modülü’nün bir ayağının yanında yürüyor; önde ayak izleri var',
  'a11-lm-3': 'Armstrong ve Aldrin, Eagle’ın merdiveninin yanında; canlı TV yayınından',
  'a12-lm-2': 'Alan Bean TV kamerasından Ay Modülü’ne doğru yürüyor',
  'a12-lm-3': 'Solda Ay Modülü; Surveyor 3, yaklaşık 180 m ötede kraterin gölgesinde saklanıyor',
  'a14-lm-2': 'Apollo 14 Ay Modülü, ilk Ay yürüyüşünde',
  'a14-lm-3': 'Alan Shepard bayrağın yanında; Ay Modülü’nün gölgesi çevresini sarmış',
  'a15-lm-2': 'Ay’daki Apollo 15 Ay Modülü Falcon',
  'a15-lm-3': 'Falcon’ın üst yarısı havalanmadan saniyeler önce, aracın TV kamerasından görülüyor',
  'a16-lm-2': 'Hareket halindeki araçtan, uzaktan görünen Orion',
  'a16-lm-3': 'Havalanan Orion, aracın TV kamerasından görülüyor',
  'a17-lm-2': 'Challenger’ın iniş kademesi hâlâ Ay’da; LRO’nun yörüngeden görüntüsü',
  'a17-lm-3': 'Challenger’ın üst yarısı Taurus-Littrow’dan havalanıyor, aracın TV kamerasından görülüyor',
  'a15-lrv-2': 'James Irwin Ay aracının yanında; lazer aynası hâlâ paketli halde Ay Modülü’nde bekliyor',
  'a15-lrv-3': 'Dave Scott, Falcon’a dönüş yolculuğu için araçta bekliyor',
  'a16-lrv-2': 'John Young Ay aracını son park yerine sürüyor',
  'a16-lrv-3': 'Charlie Duke, North Ray Krateri yakınındaki kaya alanında aracın önünde',
  'a17-lrv-2': 'Bantla onarılmış çamurluğuyla Ay aracının yakın çekimi',
  'a17-lrv-3': 'Gene Cernan park halindeki araca yürüyor; arkada South Massif',
  'a11-lrrr-2': 'Lazer aynası (sağda) ve sismometre (en arkada), Ay Modülü’nün içinden görülüyor',
  'a11-lrrr-3': 'Buzz Aldrin sismometreyi, sağ elinde de lazer aynasını taşıyor',
  'a12-alsep-2': 'Alan Bean ilk Ay yürüyüşünde bilim istasyonunu kuruyor',
  'a12-alsep-3': 'Alan Bean iki bilim istasyonu paketini Ay Modülü’nden uzağa taşıyor',
  'a14-alsep-2': 'Arkada merkezi istasyon, önde bir sismik deney',
  'a14-alsep-3': 'Merkezi istasyonun yakın çekimi',
  'a15-alsep-2': 'Görev Kontrol’deki bilim insanları, Ay’a çarpan bir roket kademesinin sismometre kaydını inceliyor',
  'a16-alsep-2': 'John Young bilim istasyonu alanında; deneyler arkasında',
  'a17-alsep-2': 'Önde bir jeofon bayrağı; arkada bilim istasyonu ve Ay aracı',

  // ── Mars extras ──────────────────────────────
  'viking-1-2': 'Viking İniş Aracı 1’in ilk renkli fotoğrafı',
  'viking-1-3': 'Viking İniş Aracı 1 bölgesinde gün batımı',
  'viking-2-2': 'Viking İniş Aracı 2 bölgesinin ilk renkli fotoğrafı',
  'pathfinder-2': 'İniş günü: Sojourner hâlâ iniş aracının güneş panellerinden birinin üzerinde',
  'sojourner-2': 'Sojourner bir kayadan uzaklaşıyor',
  'sojourner-3': 'Sojourner’ın yumuşak toprakta bıraktığı tekerlek izleri',
  'spirit-2': 'Spirit’in tekerlekleri, takılıp kaldığı yumuşak zeminde yarı gömülü, 2009',
  'opportunity-2': 'Opportunity’nin üzerinde kırağı',
  'opportunity-3': 'Opportunity, Victoria Krateri’nin kenarında; yörüngeden görüntü',
  'phoenix-2': 'Phoenix iniş aracının altı',
  'curiosity-2': 'Curiosity’nin “Hutton” sondaj deliğinde çektiği selfie, 2020',
  'curiosity-3': 'Vera Rubin Sırtı’ndaki “Rock Hall”da, toz fırtınası sırasında tozlu bir selfie',
  'insight-2': 'İnişte InSight’ın itici motorlarının açtığı iki çukur',
  'insight-3': 'InSight, fırlatmadan önce Dünya’da bir testte güneş panellerini açıyor',
  'perseverance-2': 'Perseverance’a tekerlekler takılıyor, Kennedy Uzay Merkezi, Mart 2020',
  'ingenuity-2': 'Ingenuity, Mars’ta uçan helikopter, fırlatmadan önce',
  'ingenuity-3': 'Ingenuity’nin alt tarafı ve iki kamerası',
  'three-forks-2': '368 fotoğraftan birleştirilmiş tamamlanmış örnek deposu',
  'three-forks-3': '10. ve son tüp, Three Forks’a yeni bırakıldı',

  // ── Deep Space extras ────────────────────────
  'pioneer-10-2': 'Jüpiter’in uydusu Ganymede, Pioneer 10’un fotoğrafı',
  'pioneer-10-3': 'Pioneer 10, Kaliforniya’daki TRW’de son montajda',
  'voyager-2-2': 'Uranüs, Voyager 2’nin 1986’da çektiği fotoğraf',
  'voyager-2-3': 'Voyager 2 üzerinde çalışan mühendisler, Mart 1977',
  'voyager-1-2': 'Voyager 1, Cape Canaveral’dan fırlatılıyor, 5 Eylül 1977',
  'voyager-1-3': 'Jüpiter’in uydusu Europa, Voyager 1’in fotoğrafı',
  'ulysses-2': 'Ulysses ve iki fırlatıcı kademesi, Kennedy’de yük kapsülüne taşınıyor',
  'ulysses-3': 'Ulysses’in anteni Dünya’yı göstermeye devam edebilsin diye dönme dengelemesi yapılıyor',
  'near-2': 'Eros’taki “eyer”, 208 km uzaktan fotoğraflanmış',
  'stardust-2': 'Stardust’ın ziyaret ettiği üç küçük dünya: Annefrank asteroidi, Wild 2 kuyruklu yıldızı, Tempel 1 kuyruklu yıldızı',
  'stardust-3': 'Stardust’ın kuyruklu yıldız tozuyla dolu kapsülü, Utah’taki iniş yerinde kaldırılıyor',
  'spitzer-2': 'Teleskobun 2003’teki fırlatmasından önce son rötuşlar',
  'spitzer-3': 'Messier 101 gökadası, Spitzer’in kızılötesi ışıkta gördüğü haliyle',
  'deep-impact-2': 'Tempel 1 kuyruklu yıldızının çekirdeği, geçiş aracının gözünden',
  'dawn-2': 'Dev asteroit Vesta’da gün doğumu, Dawn’ın gözünden',
  'kepler-2': 'Boulder, Colorado’daki Ball Aerospace’te Kepler',
}

/** Feature/place/star names that have a usual Turkish form, keyed by the exact English string */
export const NAME_TR: Record<string, string> = {
  // constellations (stars.ts)
  Taurus: 'Boğa',
  Gemini: 'İkizler',
  Leo: 'Aslan',
  Virgo: 'Başak',
  Scorpius: 'Akrep',
  Sagittarius: 'Yay',
  Aquila: 'Kartal',
  Aries: 'Koç',
  // deepSky.ts object names
  'Galactic center': 'Gökada merkezi',
  'Large Magellanic Cloud': 'Büyük Macellan Bulutu',
  'Andromeda galaxy': 'Andromeda Gökadası',
}

/** deepSky.ts `sub` lines, keyed by object name */
export const DEEPSKY_SUB_TR: Record<string, string> = {
  'Alpha Centauri': 'EN YAKIN YILDIZLAR · 4,4 IŞIK YILI',
  Sirius: 'EN PARLAK YILDIZ · 8,6 IŞIK YILI',
  'Galactic center': 'SAMANYOLU’NUN KALBİ · 26.000 IŞIK YILI',
  'Large Magellanic Cloud': 'KOMŞU GÖKADA · 160.000 IŞIK YILI',
  'Andromeda galaxy': 'EN YAKIN BÜYÜK GÖKADA · 2,5 MİLYON IŞIK YILI',
}

/** stars.ts DESTINATIONS (Pioneer heading text, ALL CAPS pixel font), keyed by probe id */
export const DESTINATIONS_TR: Record<string, { label: string; sub: string }> = {
  'pioneer-10': { label: '→ ALDEBARAN', sub: '~2 MİLYON YIL' },
  'pioneer-11': { label: '→ KARTAL', sub: '~4 MİLYON YIL' },
}

/** lastSignal strings that are text rather than a date, keyed by the exact English string */
export const LASTSIGNAL_TR: Record<string, string> = {
  'Still in use today': 'Bugün hâlâ kullanılıyor',
  'Still driving today': 'Bugün hâlâ sürüyor',
  'Still talking today': 'Bugün hâlâ konuşuyor',
  'Waiting for pickup': 'Alınmayı bekliyor',
}

/** kindLabel (hardware.ts), keyed by HardwareKind */
export const KIND_TR: Record<string, string> = {
  lander: 'İniş aracı',
  rover: 'Gezgin',
  science: 'Bilim istasyonu',
  reflector: 'Lazer aynası',
  robot: 'Robot iniş aracı',
  helicopter: 'Helikopter',
  probe: 'Uzay sondası',
  telescope: 'Uzay teleskobu',
}
