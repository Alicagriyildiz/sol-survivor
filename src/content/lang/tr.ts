// All player-facing text (Turkish). Add another language by copying this file's shape.

export interface OptionText {
  label: string;
  why: string;
}
export interface FaultText {
  title: string;
  desc: string;
  options: Record<string, OptionText>;
}
export interface SolText {
  title: string;
  weather: string;
  message: string;
}

export const tr = {
  ui: {
    appTitle: 'Sol Survivor',
    tagline: 'Mars üssünü 15 sol boyunca ayakta tut. Sol 15\'te ikmal aracı iniyor.',
    start: 'Göreve başla',
    seed: 'Görev numarası',
    randomSeed: 'Başka görev',
    level: 'Seviye',
    junior: 'Genç Astronot',
    commander: 'Komutan',
    juniorHint: 'Renkli ışıklar ve ipuçları açık.',
    commanderHint: 'Sayılar ve doz görünür, ipucu az.',
    sol: 'Sol',
    of: '/',
    hoursLeft: 'Kalan mesai',
    hoursUnit: 'sa',
    location: 'Buradasın',
    noWalk: 'Yürüme yok',
    briefing: 'Sabah brifingi',
    weather: 'Hava durumu',
    earthMessage: 'Dünya\'dan mesaj',
    earthDelay: 'Bu mesaj Mars\'a ulaşana kadar dakikalar geçti. O sırada durum değişmiş olabilir.',
    startDay: 'İşe koyul',
    stations: 'İstasyonlar',
    walk: 'yürüme',
    work: 'iş',
    eva: 'EVA',
    evaShort: 'Dışarı çıkış (EVA): +1 sa giyinme, Yaşam Desteği ve doz harcar.',
    locked: 'Kilitli',
    lockedStorm: 'Toz fırtınası var, dışarı çıkılamaz.',
    lockedLanding: 'İniş alanı Sol 13\'te açılır.',
    problems: 'sorun',
    noProblems: 'Burada sorun yok.',
    routineTitle: 'Bakım işi',
    routineDone: 'Bugün yapıldı',
    choose: 'Bunu yap',
    deferAuto: 'Günü bitirirsen açık kalan sorunlar kendiliğinden ertelenir.',
    needs: 'Gerekli',
    notEnoughHours: 'Mesai yetmiyor',
    missingItem: 'Envanterde yok',
    requiresMissing: 'Bunun için daha önce hazırlık gerekirdi',
    close: 'Kapat',
    endSol: 'Günü bitir',
    endSolConfirm: 'Açık sorunlar ertelenecek. Günü bitireyim mi?',
    yes: 'Evet',
    no: 'Hayır',
    inventory: 'Envanter',
    warnings: 'Uyarılar',
    allGood: 'Her şey yolunda.',
    report: 'Sol sonu raporu',
    night: 'Gece neler oldu',
    whatReallyHappened: 'Gerçekte ne oldu?',
    source: 'Kaynak',
    unverified: 'doğrulanacak',
    nextSol: 'Sonraki sol',
    missionWon: 'Görev tamam! İkmal aracı geldi.',
    missionLost: 'Görev bitti.',
    lostBecause: 'Sağlık sıfıra indi. En çok zarar veren:',
    finalStats: 'Son durum',
    dose: 'Toplam doz',
    score: 'Puan',
    playAgain: 'Yeniden oyna',
    sameSeed: 'Aynı görevi tekrar oyna',
    openBlackBox: 'Kara Kutu\'yu aç',
    decisionsMade: 'karar',
    changes: 'Değişimler',
    now: 'Şimdi',
    auto: 'otomatik ertelendi',
    hint: 'İpucu',
    investHint: 'Yatırım: bugün pahalı, ileride işe yarayabilir.',
    laterCostHint: 'Bugün ucuz ama sorun tam bitmiyor.',
    glossaryTitle: 'Sözlük',
    reserve: 'Acil yedek',
    reserveUsed: 'Acil yedek devreye girdi! Bu kaynak için bir daha olmaz.',
  },
  res: {
    power: 'Güç',
    life: 'Yaşam Desteği',
    shield: 'Kalkan',
    health: 'Sağlık',
    dose: 'Radyasyon dozu',
  },
  resDesc: {
    power: 'Elektrik. Isıtıcılar, ışıklar ve makineler bununla çalışır.',
    life: 'Hava, su ve yiyecek. Hepsi tek göstergede.',
    shield: 'Radyasyona karşı koruma. Duvarlar ne kadar sağlamsa o kadar iyi.',
    health: 'Astronotun sağlığı. Sıfır olursa görev biter.',
    dose: 'Vücudun aldığı toplam radyasyon. Hiç azalmaz, sadece artar.',
  },
  status: {
    ok: 'İyi',
    low: 'Azalıyor',
    critical: 'Tehlike',
    empty: 'Bitti',
  },
  critical: {
    power: 'Güç çok düştü: üs soğuyor, Sağlık her saat azalıyor.',
    life: 'Yaşam Desteği çok düştü: hava ve su azaldı, Sağlık her saat azalıyor.',
    shield: 'Kalkan çok zayıf: radyasyon içeri sızıyor, Sağlık her saat azalıyor.',
  },
  glossary: [
    ['Sol', 'Mars\'ta bir gün. Dünya gününden biraz daha uzun.'],
    ['Radyasyon dozu', 'Vücudun aldığı görünmez ışın miktarı. Kalkan bunu azaltır.'],
    ['EVA', 'Üsten dışarı, uzay giysisiyle çıkmak.'],
    ['Regolit', 'Mars\'ın tozlu, taşlı toprağı.'],
    ['İkmal aracı', 'Dünya\'dan yiyecek, parça ve yardım getiren araç.'],
  ] as [string, string][],
  items: {
    patchKit: 'Yama kiti',
    spareFilter: 'Yedek filtre',
    tape: 'Bant',
  } as Record<string, string>,
  stations: {
    hub: { name: 'Ana üs', desc: 'Uyku, mutfak, su ünitesi ve telsiz burada.' },
    greenhouse: { name: 'Sera', desc: 'Bitkiler yiyecek ve biraz oksijen verir.' },
    shelter: { name: 'Radyasyon sığınağı', desc: 'Kalın duvarlı küçük oda.' },
    battery: { name: 'Batarya ve ısı', desc: 'Enerji deposu ve soğutma sistemi.' },
    airlock: { name: 'Hava kilidi ve depo', desc: 'Dışarı çıkış kapısı ve yedek parçalar.' },
    solar: { name: 'Güneş paneli alanı', desc: 'Dışarıda. Gitmek için EVA gerekir.' },
    landing: { name: 'İniş alanı', desc: 'Dışarıda. İkmal aracı buraya inecek.' },
  } as Record<string, { name: string; desc: string }>,
  routines: {
    tend: { label: 'Bitkilere bak', why: 'Bitkiler büyüdükçe Yaşam Desteği artar. Lambalar biraz Güç yer.' },
    tune: { label: 'Bataryaları ayarla', why: 'Ayarlı batarya enerjiyi daha iyi saklar: Güç artar.' },
    bags: { label: 'Duvara regolit torbası diz', why: 'Kalın duvar radyasyonu tutar: Kalkan artar.' },
  } as Record<string, OptionText>,
  sols: {
    1: { title: 'İlk kontrol', weather: 'Açık ve sakin. Toz az.', message: 'Hoş geldin! Önce üssü uyandır. Acele etme, her istasyona bir bak.' },
    2: { title: 'Su ünitesi', weather: 'Açık. Gece çok soğuk olacak.', message: 'Su geri kazanım ünitesinin verileri biraz garip görünüyor. Bir bakar mısın?' },
    3: { title: 'Seradaki tuz', weather: 'Hafif rüzgar.', message: 'Toprak ölçümün geldi. İçinde perklorat diye bir tuz var. Bitkiler için iyi değil.' },
    4: { title: 'Tozlu paneller', weather: 'Gökyüzü tozlu. Paneller üstünde toz birikiyor.', message: 'Güç üretimi düşüyor. Panellerde toz olabilir.' },
    5: { title: 'Oksijen makinesi', weather: 'Açık.', message: 'Oksijen deposu beklenenden hızlı azalıyor. Oksijen üretecini çalıştırmayı düşün.' },
    6: { title: 'Sığınak duvarı', weather: 'Sakin. Güneş biraz hareketli görünüyor.', message: 'Sığınak duvarı ince kalmış. Zamanın varsa güçlendir.' },
    7: { title: 'Gecikmeli talimat', weather: 'Ufukta toz bulutları var.', message: 'Fırtına mevsimi yaklaşıyor. Yaşam Desteğini kıs, bataryaları doldur. İniş günü için fener bataryasını ayır.' },
    8: { title: 'Fırtına uyarısı', weather: 'Büyük toz fırtınası geliyor! Bu gece başlayacak.', message: 'Fırtına günlerce sürebilir. Bugün hazırlanmak için son şansın.' },
    9: { title: 'Fırtına', weather: 'Toz fırtınası. Güneş neredeyse görünmüyor. Dışarı çıkmak yasak.', message: 'Sinyal zayıf... Güç... dikkatli kullan...' },
    10: { title: 'Filtre uymuyor', weather: 'Fırtına sürüyor.', message: 'Karbondioksit artıyor. Yedek filtre başka bir modülden; yuvaya tam uymayabilir.' },
    11: { title: 'Fırtına bitti', weather: 'Gökyüzü açılıyor. Rüzgar esiyor.', message: 'Fırtına geçti! Paneller toz altında kalmış olmalı.' },
    12: { title: 'Güneş patlaması', weather: 'Güneşte büyük bir patlama oldu. Parçacıklar yolda!', message: 'Uyarı: bugün radyasyon yükselecek. Sığınağı düşün.' },
    13: { title: 'Gizli sızıntı', weather: 'Sakin. İniş alanına artık gidebilirsin.', message: 'Basınç yavaşça düşüyor. Bir yerde minik bir delik olabilir.' },
    14: { title: 'Sıcak bataryalar', weather: 'Açık ve sıcak bir gün.', message: 'Soğutma sistemi verisi kırmızı. Bataryalar ısınıyor.' },
    15: { title: 'İkmal günü', weather: 'Açık. İniş için iyi bir gün.', message: 'İkmal aracı bugün iniyor! İşaret fenerini çalıştırırsan seni kolay bulur.' },
  } as Record<number, SolText>,
  faults: {
    s1_wakeup: {
      title: 'Üssü uyandır',
      desc: 'Sistemler uykuda. Hava fanları, ısıtıcılar ve su ünitesi açılmalı.',
      options: {
        stepByStep: { label: 'Tek tek aç ve kontrol et', why: 'Yavaş ama düzgün: hava temizlenir, Yaşam Desteği artar. Biraz Güç harcar.' },
        allAtOnce: { label: 'Hepsini birden aç', why: 'Hızlı, ama hepsi aynı anda çalışınca çok Güç çeker.' },
        defer: { label: 'Sonra hallederim', why: 'Fanlar geç açılırsa hava ağırlaşır: Yaşam Desteği azalır.' },
      },
    },
    s1_seal: {
      title: 'Hava kilidi contası',
      desc: 'Kapının lastik contası tozlanmış. Biraz hava kaçırıyor olabilir.',
      options: {
        newSeal: { label: 'Yeni conta tak', why: 'Kalıcı çözüm. Hava kaçmaz, Yaşam Desteği korunur.' },
        wipe: { label: 'Silip geç', why: 'Çabuk biter. Ama toz geri gelir, iki gün sonra biraz hava kaçar.' },
        defer: { label: 'Ertele', why: 'Her gece biraz hava kaçar. Yarın sorun yine karşına çıkar.' },
      },
    },
    s2_pump: {
      title: 'Su ünitesi tıkırdıyor',
      desc: 'Su geri kazanım ünitesinin pompası garip sesler çıkarıyor. Bu ünite kullanılmış suyu yeniden içilir yapar.',
      options: {
        overhaul: { label: 'Pompayı sök, temizle, yağla', why: 'Uzun sürer ve Güç ister. Ama ünite sağlam kalır; ileride başka bir arızada işine yarayabilir.' },
        oil: { label: 'Sadece biraz yağla', why: 'Şimdilik susar. Birkaç gün sonra yıpranır, su kaybedersin.' },
        defer: { label: 'Ertele', why: 'Ünite her gece su kaçırır: Yaşam Desteği azalır. Sorun yarın da orada.' },
      },
    },
    s2_filter: {
      title: 'Su filtresi tıkandı',
      desc: 'Su geri kazanım ünitesinin filtresi tıkanmış. Bu ünite kullanılmış suyu yeniden içilir yapar.',
      options: {
        replace: { label: 'Filtre bölmesini yenile', why: 'Güç ve biraz su harcar. Ünite sağlam kalır; ileride işine yarayabilir.' },
        backflush: { label: 'Ters yönde su basarak temizle', why: 'Güç harcamaz ama çok su harcar: Yaşam Desteği düşer. Ünite sağlam kalır.' },
        tap: { label: 'Vurup tozunu al', why: 'Hızlı. Ama tıkanma birkaç gün sonra geri gelir.' },
        defer: { label: 'Ertele', why: 'Ünite her gece su kaçırır: Yaşam Desteği azalır. Sorun yarın da orada.' },
      },
    },
    s3_soil: {
      title: 'Toprakta perklorat',
      desc: 'Sera toprağında perklorat adlı bir tuz var. İnsan için zararlı. Bitkiler bu toprakta iyi büyümez.',
      options: {
        wash: { label: 'Toprağı suyla yıka', why: 'Tuz suyla akıp gider. Su ve Güç harcar. Temiz toprakta bitkiler her gece biraz yiyecek ve hava verir.' },
        hydro: { label: 'Bitkileri topraksız tepsiye taşı', why: 'Su ile büyüyen bitkiler. Pompası her gece biraz Güç yer. Bitkiler her gece Yaşam Desteği verir.' },
        hardy: { label: 'Sadece dayanıklı bitkileri ek', why: 'Hızlı ve ucuz. Ama az ürün verir.' },
        defer: { label: 'Ertele', why: 'Bitki yetişmezse yiyecek stoğun hızlı azalır.' },
      },
    },
    s4_dust: {
      title: 'Panellerde toz',
      desc: 'Güneş panellerinin üstü tozla kaplandı. Her gece daha az elektrik üretiliyor.',
      options: {
        brush: { label: 'Dışarı çık, panelleri fırçala', why: 'Paneller tertemiz olur, Güç artar. Ama EVA hava ve doz harcar.' },
        sandTrick: { label: 'Panel kenarına kum serp, rüzgar temizlesin', why: 'Rüzgar kumu sürükleyince tozu da alır. Biraz toz kalır. Paneller bundan sonra rüzgarla daha kolay temizlenir.' },
        dim: { label: 'Işıkları kıs, tozu bırak', why: 'Dışarı çıkmazsın. Ama toz kalır, birkaç gece az elektrik üretilir.' },
        defer: { label: 'Ertele', why: 'Toz kalır. Her gece Güç kaybedersin, ta ki bir şey onu temizleyene kadar.' },
      },
    },
    s5_oxygen: {
      title: 'Oksijen üreteci',
      desc: 'Bu makine Mars havasındaki karbondioksitten oksijen yapar. Ama çok elektrik yer.',
      options: {
        fullPower: { label: 'Tam güçte çalıştır', why: 'Çok oksijen: Yaşam Desteği epey artar. Ama Güç çok düşer.' },
        halfNight: { label: 'Gece yarı güçte çalıştır', why: 'Orta yol: biraz oksijen, biraz Güç.' },
        plants: { label: 'Bitkilerin oksijenine güven', why: 'Bitkiler sağlıklıysa iyi oksijen verir. Toprak temiz değilse az verir.' },
        defer: { label: 'Ertele', why: 'Oksijen azalmaya devam eder: Yaşam Desteği düşer.' },
      },
    },
    s6_shelter: {
      title: 'İnce sığınak duvarı',
      desc: 'Radyasyon sığınağının duvarı ince. Güneşte bir patlama olursa yetmeyebilir.',
      options: {
        regolith: { label: 'Duvara kalın regolit katmanı ekle', why: 'Bugün çok mesai ve Güç ister. Kalkan artar. Güneş patlarsa sığınak çok daha iyi korur.' },
        waterWall: { label: 'Su bidonlarını duvara diz', why: 'Su da radyasyonu tutar. Biraz su kaybı olur. Sığınak biraz daha iyi korur.' },
        defer: { label: 'Şimdi gerek yok', why: 'Mesai kazanırsın. Ama duvardaki çatlak büyür ve sığınak zayıf kalır.' },
      },
    },
    s7_message: {
      title: 'Dünya\'dan talimat',
      desc: 'Mesaj yazıldığında Yaşam Desteğin iyiydi. Ama mesaj yoldayken durum değişti. Talimata uyacak mısın?',
      options: {
        follow: { label: 'Talimata uy', why: 'Bataryalar dolar ve iniş günü için fener yedeği ayrılır. Ama Yaşam Desteği kısılır.' },
        ownCall: { label: 'Kendi kararını ver: Yaşam Desteğini koru', why: 'Bugün havan ve suyun iyi olur. Fener için yedek ayrılmaz.' },
        report: { label: 'Yarısını uygula, Dünya\'ya durum raporu gönder', why: 'Uzun sürer. Biraz Güç biriktirirsin. Dünya iniş planını senin raporuna göre ayarlar.' },
        defer: { label: 'Mesajı sonra oku', why: 'Dünya cevap alamayınca mesajı tekrar gönderir. Yarın onu okumak mesai harcar.' },
      },
    },
    s8_charge: {
      title: 'Bataryaları doldur',
      desc: 'Fırtınada Güneş görünmeyecek. Bataryalar ne kadar doluysa o kadar iyi.',
      options: {
        full: { label: 'Gereksiz her şeyi kapat, tam doldur', why: 'Bataryalar dolar ve fırtına darbesi hafifler. Kapanan sistemler Yaşam Desteğini biraz düşürür.' },
        half: { label: 'Yarısına kadar doldur', why: 'Biraz Güç biriktirirsin. Fırtına darbesi yine sert olur.' },
        defer: { label: 'Ertele', why: 'Mesai kazanırsın. Ama fırtına bataryaları boş yakalar.' },
      },
    },
    s8_secure: {
      title: 'Panelleri sabitle',
      desc: 'Fırtına rüzgarı panellerin üstüne çok toz yığabilir.',
      options: {
        anchor: { label: 'Dışarı çık, panelleri yatır ve bağla', why: 'EVA hava ve doz harcar. Fırtınadan sonra panellerde daha az toz olur.' },
        cables: { label: 'Sadece kabloları içeri al', why: 'Kısa iş, dışarı çıkmazsın. Biraz işe yarar.' },
        defer: { label: 'Ertele', why: 'Mesai kazanırsın. Fırtına panellere çok toz yığar.' },
      },
    },
    s9_shed: {
      title: 'Güç çöküyor: neyi kapatacaksın?',
      desc: 'Fırtına güneşi kapattı. Her şeyi açık tutacak kadar elektrik yok. Bir şeyi kapatmalısın.',
      options: {
        greenhouseOff: { label: 'Sera lambalarını kapat', why: 'Güç kazanırsın. Ama bitkiler ölür, artık yiyecek ve hava vermezler.' },
        heaterDown: { label: 'Isıtıcıyı kıs', why: 'En çok Güç bundan kazanılır. Ama üşürsün: Sağlık düşer.' },
        shelterHeat: { label: 'Sığınak duvar ısıtıcısını kapat', why: 'Güç kazanırsın. Ama soğukta duvar çatlar: Kalkan düşer.' },
        defer: { label: 'Hiçbir şeyi kapatma', why: 'Her şey çalışmaya devam eder. Ama gece Güç çok hızlı biter.' },
      },
    },
    s10_co2: {
      title: 'Karbondioksit filtresi uymuyor',
      desc: 'Havadaki karbondioksiti tutan filtre doldu. Yedek filtre başka modülün: köşeli, yuva ise yuvarlak!',
      options: {
        adapter: { label: 'Yuvayı söküp yedek filtreye göre yeniden yap', why: 'Uzun sürer ve yedek filtreni kullanır. Hava çok iyi temizlenir.' },
        apollo: { label: 'Bant, torba ve hortumla uydur', why: 'Yaratıcı çözüm! Hava temizlenir. Ama iki bandın da biter; başka bir arızada bant kalmaz.' },
        shake: { label: 'Eski filtreyi silkele', why: 'Biraz işe yarar. Ama filtre ertesi gece yine dolar.' },
        defer: { label: 'Ertele', why: 'Karbondioksit her gece artar: Yaşam Desteği düşer. Sorun yarın da orada.' },
      },
    },
    s11_panels: {
      title: 'Paneller toz altında',
      desc: 'Fırtına bitti ama paneller toza gömüldü. Güç üretimi çok düşük.',
      options: {
        brush: { label: 'Dışarı çık, hepsini fırçala', why: 'Paneller temizlenir, Güç artar. EVA uzun sürer, hava ve doz harcar.' },
        halfClean: { label: 'Yarısını temizle', why: 'Daha kısa EVA. Toz biraz kalır.' },
        defer: { label: 'Rüzgarın temizlemesini bekle', why: 'Kumar! Rüzgar bazen panelleri temizler, bazen temizlemez. Panelleri önceden hazırladıysan şansın artar.' },
      },
    },
    s12_spe: {
      title: 'Güneş parçacık fırtınası!',
      desc: 'Güneşten gelen hızlı parçacıklar üssü vuruyor. Sığınakta beklersen daha az radyasyon alırsın ama mesai kaybedersin.',
      options: {
        hideAll: { label: 'Olay bitene kadar sığınakta kal', why: 'En az radyasyon. Ama günün çoğu gider. Sığınak duvarın ne kadar kalınsa o kadar iyi.' },
        hideShort: { label: 'Bir süre sığınakta kal, sonra çalış', why: 'Orta yol. Biraz radyasyon alırsın.' },
        waterCorner: { label: 'Su bidonlarıyla çalışma köşesi yap', why: 'Çalışmaya devam edersin, su bidonları biraz korur. Biraz su harcanır.' },
        defer: { label: 'Çalışmaya devam et', why: 'Mesai kaybetmezsin. Ama çok radyasyon alırsın: doz artar, Sağlık düşer.' },
      },
    },
    s13_leakA: {
      title: 'Hava kilidinde sızıntı',
      desc: 'Basınç yavaşça düşüyor. Delik çok küçük, görmek zor.',
      options: {
        patchKit: { label: 'Yama kitiyle kalıcı yama', why: 'Sağlam yama. Yama kitini kullanır.' },
        teaLeaves: { label: 'Çay yaprağı yöntemi: deliği bul, bantla', why: 'Uçuşan çay yaprakları deliğe doğru gider! Bir bant kullanır.' },
        sealOff: { label: 'Bölmeyi kapat, kullanma', why: 'Hızlı. Ama kapının arkasından biraz hava kaçmaya devam eder.' },
        defer: { label: 'Ertele', why: 'Her gece hava kaçar: Yaşam Desteği düşer. Sorun yarın da orada.' },
      },
    },
    s13_leakB: {
      title: 'Serada sızıntı',
      desc: 'Basınç yavaşça düşüyor. Delik sera duvarında bir yerde.',
      options: {
        patchKit: { label: 'Yama kitiyle kalıcı yama', why: 'Sağlam yama. Yama kitini kullanır.' },
        teaLeaves: { label: 'Çay yaprağı yöntemi: deliği bul, bantla', why: 'Uçuşan çay yaprakları deliğe doğru gider! Bir bant kullanır.' },
        sealOff: { label: 'Serayı kapat, kullanma', why: 'Hızlı. Ama kapının arkasından biraz hava kaçmaya devam eder.' },
        defer: { label: 'Ertele', why: 'Her gece hava kaçar: Yaşam Desteği düşer. Sorun yarın da orada.' },
      },
    },
    s13_pad: {
      title: 'İniş alanında kayalar',
      desc: 'İkmal aracının ineceği yerde kayalar var. Araç başka yere inebilir.',
      options: {
        clearPad: { label: 'Dışarı çık, kayaları temizle', why: 'EVA hava ve doz harcar. Araç tam buraya iner.' },
        markPad: { label: 'Sadece işaret koy', why: 'Kısa EVA. Araç yeri daha kolay bulur.' },
        defer: { label: 'Ertele', why: 'Mesai kazanırsın. Araç uzağa inebilir; malzemeleri getirmek zor olur.' },
      },
    },
    s14_pump: {
      title: 'Soğutma pompası durdu',
      desc: 'Bataryaları soğutan pompa çalışmıyor. Bataryalar ısınınca enerji kaybeder.',
      options: {
        replacePump: { label: 'Pompayı değiştir', why: 'Uzun ve zor iş. Ama soğutma tamamen düzelir.' },
        borrowPump: { label: 'Su ünitesinin pompasını ödünç al', why: 'Su ünitesi sağlamsa pompası bir süre burada çalışabilir. Su ünitesi bir süre durur.' },
        halfBattery: { label: 'Bataryaların yarısını kapat', why: 'Isınma durur. Ama kapanan bataryalardaki Güç gider.' },
        defer: { label: 'Ertele', why: 'Bataryalar her gece Güç kaybeder. Sorun yarın da orada.' },
      },
    },
    s14_radiator: {
      title: 'Isı radyatörü tıkandı',
      desc: 'Dışarıdaki ısı radyatörü tozla tıkandı. Bataryalar ısınınca enerji kaybeder.',
      options: {
        cleanRadiator: { label: 'Dışarı çık, radyatörü temizle', why: 'EVA hava ve doz harcar. Soğutma tamamen düzelir.' },
        borrowPump: { label: 'Su ünitesinin pompasıyla içeriden soğut', why: 'Su ünitesi sağlamsa pompası bir süre burada çalışabilir. Su ünitesi bir süre durur.' },
        halfBattery: { label: 'Bataryaların yarısını kapat', why: 'Isınma durur. Ama kapanan bataryalardaki Güç gider.' },
        defer: { label: 'Ertele', why: 'Bataryalar her gece Güç kaybeder. Sorun yarın da orada.' },
      },
    },
    s15_beacon: {
      title: 'İkmal aracı iniyor!',
      desc: 'İşaret feneri aracı doğru yere yönlendirir. Fener çok Güç ister.',
      options: {
        fullBeacon: { label: 'Feneri tam güçle yak', why: 'Araç yakına iner. Fener için yedek ayırdıysan az Güç harcar, ayırmadıysan çok.' },
        dimBeacon: { label: 'Feneri kısık yak, Yaşam Desteğini koru', why: 'Az Güç harcar. Araç uzağa inebilir; iniş alanı hazırsa ya da Dünya\'ya rapor gönderdiysen yakına iner.' },
        reflectors: { label: 'Dışarı çık, iniş alanına yansıtıcı ser', why: 'Fener yerine güneş ışığını yansıtırsın. EVA hava ve doz harcar. İniş alanı hazırsa iş kolay.' },
        defer: { label: 'Feneri yakma', why: 'Güç harcamazsın. Ama araç çok uzağa iner; malzemeleri getirmek çok zor olur.' },
      },
    },
  } as Record<string, FaultText>,
  /** Labels for delayed effects and nightly modifiers, used in reports and the Black Box. */
  effects: {
    sealWear: 'Kapı contası yine tozlandı',
    recyclerWorn: 'Su ünitesi yıprandı',
    foodShort: 'Yiyecek stoğu azaldı',
    repeatMessage: 'Dünya mesajı tekrar gönderdi',
    fullLoad: 'Her şey açık kalınca Güç hızlı bitti',
    filterClogged: 'Eski filtre yine doldu',
    windCleaned: 'Rüzgar panelleri temizledi',
    sealLeak: 'Kapıdan hava kaçıyor',
    waterLoss: 'Su ünitesi su kaçırıyor',
    garden: 'Sera bitkileri',
    hydroPump: 'Sera pompası',
    dust: 'Panellerde toz',
    dustLight: 'Panellerde az toz',
    dustStays: 'Panellerde toz',
    storm: 'Toz fırtınası',
    co2: 'Karbondioksit birikiyor',
    stormDust: 'Fırtına tozu panellerde',
    stormDustHalf: 'Panellerde biraz fırtına tozu',
    leak: 'Hava sızıntısı',
    leakSmall: 'Kapalı bölmeden az hava kaçıyor',
    overheat: 'Bataryalar ısınıyor',
    night: 'Gece tüketimi',
    morning: 'Sabah olayı',
  } as Record<string, string>,
  /** Short names of each sol's scripted event, for the Black Box. */
  events: {
    'sol4.morning': 'Panellere toz yağdı',
    'sol8.night': 'Toz fırtınası başladı',
    'sol9.morning': 'Fırtına güneşi kapattı',
    'sol10.morning': 'Karbondioksit birikmeye başladı',
    'sol11.morning': 'Fırtına bitti, paneller tozlu',
    'sol13.morning': 'Sızıntı başladı',
    'sol14.morning': 'Soğutma bozuldu',
  } as Record<string, string>,
  blackbox: {
    title: 'Kara Kutu',
    intro: 'Kara Kutu görevdeki her kararını kaydetti. Birini değiştir ve ne olurdu, birlikte görelim.',
    step1: '1. Bir karar seç',
    step2: '2. Yerine ne yapardın?',
    step3: '3. Tahminin ne?',
    predictSave: 'Kurtulurdum',
    predictSame: 'Yine olmazdı',
    predictWinStill: 'Yine kazanırdım',
    predictWinLose: 'Kaybederdim',
    run: 'Görevi yeniden hesapla',
    yourMission: 'Senin görevin',
    otherMission: 'Değişen görev',
    survived: 'Hayatta kaldın',
    died: 'Görev bitti (Sol {sol})',
    predictionRight: 'Tahminin doğru çıktı!',
    predictionWrong: 'Tahminin tutmadı. Bu da öğrenmenin parçası.',
    why: 'Neden?',
    chosen: 'Seçtiğin',
    instead: 'Yerine',
    unavailable: 'O an yapılamazdı',
    findRescues: 'Hangi tek karar kurtarırdı?',
    rescuesFound: 'Bu kararlardan birini değiştirseydin sonuç değişirdi:',
    noRescue: 'Tek karar yetmezdi. Birkaç şeyin birlikte değişmesi gerekirdi.',
    flipsFound: 'Bu kararlardan biri değişseydin görev kötü bitebilirdi:',
    noFlip: 'Hiçbir tek karar sonucu bozmazdı. Sağlam bir görevdi!',
    skipped: 'Bazı sonraki kararların bu yolda yapılamadı; onlar o gün ertelenmiş sayıldı.',
    autopilot: 'Sol {sol}{abl} sonrasını otomatik pilot oynadı (senin kaydın orada bitiyordu).',
    back: 'Geri',
    chart: 'Sağlık eğrisi',
    // explanation sentences
    exChanged: 'Sol {sol}: "{old}" yerine "{new}" seçtin.',
    exImmediate: 'Hemen: {diffs}.',
    exLinked: 'Sol {sol}: {what}. {diffs}.',
    exCritical: '{res} kritik seviyede {more}: Sağlık bu yüzden {amount} {dir} düştü.',
    exOutcomeSave: 'Sonuç: görevi kurtarırdın (Sağlık {a} yerine {b}).',
    exOutcomeLose: 'Sonuç: görev Sol {sol}{loc} biterdi.',
    exOutcomeSameWin: 'Sonuç: yine kazanırdın, Sağlık {a} yerine {b} olurdu.',
    exOutcomeSameLose: 'Sonuç: görev yine biterdi (Sol {solA} yerine Sol {solB}).',
    exOutcomeSameLoseSameSol: 'Sonuç: görev yine Sol {sol}{loc} biterdi.',
    exNoDiff: 'Bu değişiklik sonucu neredeyse hiç etkilemezdi.',
    more: 'daha fazla',
    less: 'daha az',
    longer: 'daha uzun kaldı',
    shorter: 'daha kısa kaldı',
    diffUnit: '{res} {n} {dir}',
  },
  /** "What really happened" notes, one per sol. Sources are in content/sources.ts. */
  notes: {
    1: 'Mars\'ta bir gün (sol), Dünya gününden yaklaşık 40 dakika daha uzundur. Mars görevlerinin ekipleri takvimlerini sollere göre tutar.',
    2: 'Uluslararası Uzay İstasyonu\'nda kullanılmış su ve nem yeniden içme suyuna çevrilir. Bu sistemin parçaları zaman zaman arızalandı; astronotlar onları onardı ya da değiştirdi.',
    3: 'NASA\'nın Phoenix aracı 2008\'de Mars toprağında perklorat adlı bir tuz buldu. Bu tuz insan için zararlıdır; Mars\'ta bitki yetiştirmek için topraktan temizlenmesi gerekebilir.',
    4: 'InSight aracının panelleri zamanla tozla kaplandı ve gücü azaldı. Ekip, robot koluyla panelin yanına kum döktü; rüzgar kumu sürükleyince panelden biraz toz kalktı.',
    5: 'Perseverance gezgininin üstündeki MOXIE adlı deney, Mars havasındaki karbondioksitten oksijen üretti. Bu iş çok elektrik gerektirir.',
    6: 'Bilim insanları, Mars\'ta yaşam alanlarını radyasyondan korumak için onları toprakla (regolit) örtmeyi ya da su gibi malzemelerle sarmayı araştırıyor.',
    7: 'Dünya ile Mars arasında bir mesajın gitmesi, gezegenlerin konumuna göre birkaç dakikadan yirmi dakikadan fazlasına kadar sürebilir. Bu yüzden Mars\'taki araçlar ve ekipler bazı kararları kendisi vermek zorundadır.',
    8: '2018\'de Mars\'ta başlayan bir toz fırtınası büyüyerek bütün gezegeni sardı.',
    9: 'Opportunity gezgini 2018 fırtınasında güneş ışığı alamadı ve Dünya ile bağlantısı kesildi. Aylarca denendi ama bir daha uyanmadı.',
    10: 'Apollo 13\'te (1970) komuta modülünün köşeli karbondioksit filtreleri, ay modülündeki yuvarlak yuvaya uymuyordu. Ekip ve yer kontrolü, torba, karton ve bantla bir bağlantı parçası yaptı.',
    11: 'Spirit ve Opportunity gezginlerinin panelleri bazen rüzgarla temizlendi ve güçleri birden arttı. Ama ne zaman olacağı önceden bilinemezdi.',
    12: 'Eylül 2017\'de Güneş\'teki büyük bir patlamanın parçacıkları Mars\'a ulaştı. Curiosity gezginindeki RAD cihazı bu artışı Mars yüzeyinde ölçtü.',
    13: 'Uluslararası Uzay İstasyonu\'nda 2020\'de küçük bir hava sızıntısının yeri, havada süzülen çay yaprakları izlenerek bulundu. 2018\'de bir Soyuz kapsülündeki küçük delik ise astronotlar tarafından yamandı.',
    14: 'Uluslararası Uzay İstasyonu\'nun amonyakla çalışan soğutma sisteminde pompa arızaları oldu. Bozuk pompaları değiştirmek için uzay yürüyüşleri yapıldı.',
    15: 'Mars\'a iniş birkaç dakika sürer. Mesajlar Dünya\'ya geç ulaştığı için araç inişi kendi kendine yönetir.',
  } as Record<number, string>,
  causeName: {
    power: 'Güç eksikliği (soğuk ve karanlık)',
    life: 'Yaşam Desteği eksikliği (hava, su, yiyecek)',
    shield: 'Radyasyon (zayıf Kalkan)',
  },
};

export type Lang = typeof tr;

/** Turkish case suffix for a number: locative ('de/'da/'te/'ta) and ablative. */
export function numSuffix(n: number, kind: 'loc' | 'abl'): string {
  const last = n % 10 !== 0 ? n % 10 : n % 100 !== 0 ? (n % 100) : 100;
  // [vowel class front?, hard consonant?] per last spoken word
  const table: Record<number, [boolean, boolean]> = {
    1: [true, false], 2: [true, false], 3: [true, true], 4: [true, true], 5: [true, true],
    6: [false, false], 7: [true, false], 8: [true, false], 9: [false, false],
    10: [false, false], 20: [true, false], 30: [false, false], 40: [false, true], 50: [true, false],
    60: [false, true], 70: [false, true], 80: [false, false], 90: [false, true], 100: [true, false],
  };
  const [front, hard] = table[last] ?? [true, false];
  const base = `${hard ? 't' : 'd'}${front ? 'e' : 'a'}`;
  return `'${base}${kind === 'abl' ? 'n' : ''}`;
}

/** Fill {placeholders}. */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}
