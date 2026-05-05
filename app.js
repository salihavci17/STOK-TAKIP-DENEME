// --- FIREBASE MODÜLLERİ ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, collection, getDocs, query, where, Timestamp,
    onSnapshot, doc, setDoc, deleteDoc, writeBatch, updateDoc, orderBy, limit
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
    getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, 
    signOut, onAuthStateChanged, sendEmailVerification 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// --- KONFİGÜRASYON ---
const firebaseConfig = {
    apiKey: "AIzaSyBdxkBa8K77nnLVFefpyzS-ACuxuZhhPc8",
    authDomain: "stok-app-ca168.firebaseapp.com",
    projectId: "stok-app-ca168",
    storageBucket: "stok-app-ca168.appspot.com",
    messagingSenderId: "599049285321",
    appId: "1:599049285321:web:0c51fb5f9331ac4e20e718"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let stoklar = {};
let sepet = [];
let html5QrCode = null;
let seciliUrunId = "";
let mevcutKullanici = null;
let mevcutRol = null;
let mevcutDurum = null;

function getUrunAdi(urun) { return urun?.urunAd || urun?.ad || "Bilinmeyen"; }
function adminMi() { return mevcutRol === 'admin'; }
function yoneticiMi() { return mevcutRol === 'admin' || mevcutRol === 'yonetici'; }

// ========== KULLANICI KAYIT (DÜZELTİLDİ) ==========
window.kullaniciKayit = async () => {
    const email = document.getElementById('registerEmail')?.value;
    const sifre = document.getElementById('registerPassword')?.value;
    if (!email || !sifre) return alert("E-posta ve şifre girin!");
    if (sifre.length < 6) return alert("Şifre en az 6 karakter!");
    
    try {
        // Firestore'daki kullanıcıları kontrol et
        const kullanicilarSnap = await getDocs(collection(db, "kullanicilar"));
        const ilkKullanici = kullanicilarSnap.empty;
        
        console.log("İlk kullanıcı mı?", ilkKullanici);
        console.log("Toplam kullanıcı sayısı:", kullanicilarSnap.size);
        
        // Firebase Auth'da kullanıcı oluştur
        const userCredential = await createUserWithEmailAndPassword(auth, email, sifre);
        const user = userCredential.user;
        
        // Email doğrulama maili gönder
        await sendEmailVerification(user);
        
        // Kullanıcı rolünü belirle
        let rol = "personel";
        let durum = "beklemede";
        
        if (ilkKullanici) {
            rol = "admin";
            durum = "aktif";
            alert("🎉 İLK KULLANICI! ADMIN yetkisiyle kaydoldunuz. Lütfen email doğrulama linkine tıklayın.");
        } else {
            alert("✅ Kayıt başarılı! Email doğrulama linkine tıklayın. Admin onayından sonra giriş yapabilirsiniz.");
        }
        
        // Firestore'a kaydet
        await setDoc(doc(db, "kullanicilar", user.uid), {
            email: email,
            rol: rol,
            durum: durum,
            kayitTarihi: Timestamp.now()
        });
        
        console.log("Kullanıcı kaydedildi:", { email, rol, durum });
        
        // Çıkış yap (email doğrulaması için)
        await signOut(auth);
        switchLoginTab('giris');
        
    } catch (e) { 
        console.error("Kayıt hatası:", e);
        alert("Kayıt hatası: " + e.message); 
    }
};

// ========== GİRİŞ ==========
window.kullaniciGiris = async () => {
    const email = document.getElementById('loginEmail')?.value;
    const sifre = document.getElementById('loginPassword')?.value;
    if (!email || !sifre) return alert("E-posta ve şifre girin!");
    
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, sifre);
        const user = userCredential.user;
        
        console.log("Giriş yapan kullanıcı:", user.email);
        console.log("Email doğrulandı mı?", user.emailVerified);
        
        // Email doğrulama kontrolü
        if (!user.emailVerified) {
            await signOut(auth);
            return alert("❌ Lütfen önce e-posta adresinize gönderilen doğrulama linkine tıklayın!");
        }
        
        // Firestore'dan kullanıcı bilgilerini al
        const userQuery = query(collection(db, "kullanicilar"), where("email", "==", email));
        const userDoc = await getDocs(userQuery);
        
        if (userDoc.empty) {
            await signOut(auth);
            return alert("Kullanıcı bilgileriniz bulunamadı! Lütfen yeniden kayıt olun.");
        }
        
        const userData = userDoc.docs[0].data();
        console.log("Firestore'daki kullanıcı:", userData);
        
        // Durum kontrolü
        if (userData.durum === 'beklemede') {
            await signOut(auth);
            return alert("⏳ Hesabınız henüz admin tarafından onaylanmadı!");
        }
        
        if (userData.durum === 'engelli') {
            await signOut(auth);
            return alert("🚫 Hesabınız engellenmiştir!");
        }
        
        alert("✅ Giriş başarılı!");
        
    } catch (e) { 
        console.error("Giriş hatası:", e);
        alert("Giriş hatası: " + e.message); 
    }
};

window.kullaniciCikis = async () => { 
    await signOut(auth); 
    window.location.reload();
};

window.switchLoginTab = (tab) => {
    const girisTab = document.querySelector('.login-tab:first-child');
    const kayitTab = document.querySelector('.login-tab:last-child');
    const girisForm = document.getElementById('girisForm');
    const kayitForm = document.getElementById('kayitForm');
    
    if (tab === 'giris') {
        if(girisTab) girisTab.classList.add('active');
        if(kayitTab) kayitTab.classList.remove('active');
        if(girisForm) girisForm.classList.add('active');
        if(kayitForm) kayitForm.classList.remove('active');
    } else {
        if(kayitTab) kayitTab.classList.add('active');
        if(girisTab) girisTab.classList.remove('active');
        if(kayitForm) kayitForm.classList.add('active');
        if(girisForm) girisForm.classList.remove('active');
    }
};

// ========== ADMIN FONKSİYONLARI ==========
window.adminKullaniciOnayla = async (userId, yeniDurum, yeniRol = null) => {
    if (!adminMi()) return alert("Bu işlem için admin yetkisi gerekli!");
    const guncelleme = { durum: yeniDurum };
    if (yeniRol) guncelleme.rol = yeniRol;
    await updateDoc(doc(db, "kullanicilar", userId), guncelleme);
    alert(`Kullanıcı ${yeniDurum === 'aktif' ? 'onaylandı' : (yeniDurum === 'engelli' ? 'engellendi' : 'reddedildi')}`);
    kullaniciListesiniGetir();
};

window.adminKullaniciEkle = async () => {
    if (!adminMi()) return alert("Bu işlem için admin yetkisi gerekli!");
    const email = document.getElementById('yeniKullaniciEmail')?.value;
    const sifre = document.getElementById('yeniKullaniciSifre')?.value;
    const rol = document.getElementById('yeniKullaniciRol')?.value;
    if (!email || !sifre) return alert("E-posta ve şifre girin!");
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, sifre);
        await sendEmailVerification(userCredential.user);
        await setDoc(doc(db, "kullanicilar", userCredential.user.uid), {
            email: email,
            rol: rol,
            durum: "aktif",
            kayitTarihi: Timestamp.now(),
            createdBy: mevcutKullanici?.email
        });
        alert("Kullanıcı eklendi!");
        kullaniciListesiniGetir();
        document.getElementById('yeniKullaniciEmail').value = "";
        document.getElementById('yeniKullaniciSifre').value = "";
    } catch (e) { alert("Hata: " + e.message); }
};

async function kullaniciListesiniGetir() {
    if (!adminMi()) return;
    try {
        const snap = await getDocs(collection(db, "kullanicilar"));
        const listeDiv = document.getElementById('kullaniciListesi');
        if (!listeDiv) return;
        
        listeDiv.innerHTML = `
            <table style="width:100%; border-collapse:collapse;">
                <thead>
                    <tr><th style="text-align:left; padding:8px;">E-posta</th><th style="padding:8px;">Rol</th><th style="padding:8px;">Durum</th><th style="padding:8px;">İşlem</th></tr>
                </thead>
                <tbody>
                    ${snap.docs.map(d => {
                        const data = d.data();
                        const durumRenk = data.durum === 'aktif' ? 'green' : (data.durum === 'beklemede' ? 'orange' : 'red');
                        return `
                            <tr>
                                <td>${data.email}</td>
                                <td style="padding:8px;"><span style="background:#3498db; color:white; padding:2px 8px; border-radius:12px;">${data.rol}</span></td>
                                <td style="padding:8px; color:${durumRenk}; font-weight:bold;">${data.durum === 'beklemede' ? '⏳ Beklemede' : (data.durum === 'aktif' ? '✅ Aktif' : '🚫 Engelli')}</td>
                                <td style="padding:8px;">
                                    ${data.durum === 'beklemede' ? `<button onclick="adminKullaniciOnayla('${d.id}', 'aktif', 'personel')" style="background:#27ae60; color:white; border:none; border-radius:5px; padding:5px 10px; margin-right:5px;">✅ Onayla</button>
                                    <button onclick="adminKullaniciOnayla('${d.id}', 'reddedildi')" style="background:#e74c3c; color:white; border:none; border-radius:5px; padding:5px 10px;">❌ Reddet</button>` : ''}
                                    ${data.durum === 'aktif' && data.rol !== 'admin' ? `<button onclick="adminKullaniciOnayla('${d.id}', 'engelli')" style="background:#e74c3c; color:white; border:none; border-radius:5px; padding:5px 10px;">🚫 Engelle</button>` : ''}
                                    ${data.durum === 'engelli' ? `<button onclick="adminKullaniciOnayla('${d.id}', 'aktif')" style="background:#27ae60; color:white; border:none; border-radius:5px; padding:5px 10px;">🔓 Aktif Et</button>` : ''}
                                    <select onchange="adminKullaniciOnayla('${d.id}', 'aktif', this.value)" style="margin-left:5px; padding:5px;">
                                        <option value="">Rol Değiştir</option>
                                        <option value="admin">Admin</option>
                                        <option value="yonetici">Yönetici</option>
                                        <option value="personel">Personel</option>
                                        <option value="goruntuleyici">Görüntüleyici</option>
                                    </select>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    } catch(e) { console.error(e); }
}

// ========== KULLANICI DURUM DİNLEME ==========
onAuthStateChanged(auth, async (user) => {
    const loginScreen = document.getElementById('loginScreen');
    const mainApp = document.getElementById('mainApp');
    if (!loginScreen || !mainApp) return;
    
    console.log("Auth state değişti:", user ? "Giriş yapıldı: " + user.email : "Çıkış yapıldı");
    
    if (user) {
        mevcutKullanici = user;
        
        // Email doğrulama kontrolü
        if (!user.emailVerified) {
            console.log("Email doğrulanmamış!");
            await signOut(auth);
            loginScreen.style.display = 'flex';
            mainApp.style.display = 'none';
            return alert("📧 Lütfen e-posta adresinize gönderilen doğrulama linkine tıklayın!");
        }
        
        // Firestore'dan kullanıcı bilgilerini al
        const q = query(collection(db, "kullanicilar"), where("email", "==", user.email));
        const snap = await getDocs(q);
        
        if (snap.empty) {
            console.log("Firestore'da kullanıcı bulunamadı!");
            await signOut(auth);
            return alert("Kullanıcı bilgileriniz bulunamadı!");
        }
        
        const userData = snap.docs[0].data();
        mevcutRol = userData.rol;
        mevcutDurum = userData.durum;
        
        console.log("Kullanıcı rolü:", mevcutRol, "Durum:", mevcutDurum);
        
        // Durum kontrolü
        if (mevcutDurum !== 'aktif') {
            console.log("Kullanıcı aktif değil:", mevcutDurum);
            await signOut(auth);
            return alert(mevcutDurum === 'beklemede' ? "⏳ Hesabınız henüz admin tarafından onaylanmadı!" : "🚫 Hesabınız engellenmiş!");
        }
        
        // UI güncelleme
        document.getElementById('userName').innerText = user.email.split('@')[0];
        document.getElementById('userRole').innerText = mevcutRol;
        loginScreen.style.display = 'none';
        mainApp.style.display = 'block';
        
        // Yetkiye göre sekme göster/gizle
        const yeniUrunTab = document.querySelector('.tab-btn[data-tab="yeni-urun"]');
        const kullaniciTab = document.querySelector('.tab-btn[data-tab="kullanicilar"]');
        if (yeniUrunTab) yeniUrunTab.style.display = yoneticiMi() ? 'block' : 'none';
        if (kullaniciTab) kullaniciTab.style.display = adminMi() ? 'block' : 'none';
        
        if (adminMi()) kullaniciListesiniGetir();
        verileriGetir();
        
    } else {
        mevcutKullanici = null;
        mevcutRol = null;
        loginScreen.style.display = 'flex';
        mainApp.style.display = 'none';
    }
});

// ========== VERİLER (ÖNCEKİ KODLAR AYNI) ==========
function verileriGetir() {
    onSnapshot(collection(db, "stoklar"), (snap) => {
        stoklar = {};
        const select = document.getElementById("urunSelect");
        if (select) select.innerHTML = '<option value="">Ürün Seçin</option>';
        snap.forEach(d => {
            const v = d.data();
            stoklar[d.id] = { id: d.id, ...v, kalan: v.kalan || 0, kritik: v.kritik || 5 };
            if (select) {
                const opt = document.createElement("option");
                opt.value = d.id;
                opt.textContent = getUrunAdi(v);
                select.appendChild(opt);
            }
        });
        stoklariListele();
        hareketleriListele();
        kritikKontrol();
        bugunOzetiniGetir();
        popularesiGetir();
    });
}

function stoklariListele() {
    const tbody = document.getElementById('tablo');
    if (!tbody) return;
    let html = "", toplam = 0, kritikSay = 0;
    let gruplar = {};
    Object.values(stoklar).forEach(u => {
        const g = u.grup || "Genel";
        if (!gruplar[g]) gruplar[g] = [];
        gruplar[g].push(u);
    });
    Object.keys(gruplar).sort().forEach((grup, idx) => {
        const grupId = `grup-${idx}`;
        html += `<tr onclick="grupToggle('${grupId}')" style="background:#f1c40f; cursor:pointer;"><td colspan="3"><b>📂 ${grup}</b></td></tr>`;
        gruplar[grup].forEach(u => {
            const m = u.kalan || 0, k = u.kritik || 5;
            toplam += m;
            if (m <= k) kritikSay++;
            html += `<tr class="${grupId}" onclick="detayGoster('${u.id}')" style="display:none; cursor:pointer;">
                        <td style="padding-left:20px;">${getUrunAdi(u)}</td>
                        <td style="color:${m <= k ? 'red' : ''}"><b>${m}</b></td>
                        <td>${yoneticiMi() ? `<button onclick="event.stopPropagation(); urunSil('${u.id}')" style="background:#e74c3c; color:white; border:none; border-radius:5px; padding:5px 10px;">✖</button>` : ''}</td>
                    </tr>`;
        });
    });
    tbody.innerHTML = html;
    document.getElementById('dashToplam').innerText = toplam;
    document.getElementById('dashKritik').innerText = kritikSay;
}

function kritikKontrol() {
    const kritikler = Object.values(stoklar).filter(u => (u.kalan || 0) <= (u.kritik || 5));
    const panel = document.getElementById('kritikPanel');
    const liste = document.getElementById('kritikListe');
    if (kritikler.length > 0) {
        if (panel) panel.style.display = 'block';
        if (liste) liste.innerHTML = kritikler.map(u => `<li><strong>${getUrunAdi(u)}</strong>: Stok ${u.kalan} / Kritik ${u.kritik}</li>`).join('');
    } else {
        if (panel) panel.style.display = 'none';
    }
}

async function hareketleriListele() {
    const tbody = document.getElementById('hareketlerTablo');
    if (!tbody) return;
    try {
        const snap = await getDocs(query(collection(db, "hareketler"), orderBy("tarih", "desc"), limit(50)));
        tbody.innerHTML = "";
        snap.forEach(d => {
            const h = d.data();
            tbody.innerHTML += `<tr><td style="font-size:12px;">${h.tarih?.toDate().toLocaleString('tr-TR') || '-'}</td><td>${h.urun || '-'}</td><td><b>${h.miktar}</b></td><td style="color:${h.tur === 'giris' ? 'green' : 'red'}"><b>${h.tur === 'giris' ? 'GİRİŞ' : 'ÇIKIŞ'}</b></td></tr>`;
        });
    } catch(e) { console.error(e); }
}

async function bugunOzetiniGetir() {
    const bugun = new Date(); bugun.setHours(0,0,0,0);
    try {
        const snap = await getDocs(query(collection(db, "hareketler"), where("tarih", ">=", Timestamp.fromDate(bugun))));
        let toplam = 0;
        snap.forEach(d => { if(d.data().tur === 'giris') toplam += d.data().miktar; });
        document.getElementById('dashGiris').innerText = toplam;
    } catch(e) { console.error(e); }
}

async function popularesiGetir() {
    try {
        const snap = await getDocs(query(collection(db, "hareketler"), where("tur", "==", "cikis")));
        const sayilar = {};
        snap.forEach(d => { const ad = d.data().urun || "Bilinmeyen"; sayilar[ad] = (sayilar[ad] || 0) + (d.data().miktar || 1); });
        const populer = Object.entries(sayilar).sort((a,b) => b[1] - a[1])[0];
        document.getElementById('dashPopuler').innerText = populer ? populer[0] : "-";
    } catch(e) { console.error(e); }
}

// ========== ÜRÜN İŞLEMLERİ ==========
window.urunEkle = async () => {
    if (!yoneticiMi()) return alert("Yetkiniz yok!");
    const ad = document.getElementById('urunAdi')?.value.trim();
    if (!ad) return alert("Ürün adı girin!");
    await setDoc(doc(collection(db, "stoklar")), { urunAd: ad, barkod: document.getElementById('urunBarkod')?.value || "", kalan: 0, kritik: 5, grup: "Genel" });
    alert("Ürün eklendi!");
    document.getElementById('urunAdi').value = "";
    document.getElementById('urunBarkod').value = "";
};

window.stokIslem = async (tip) => {
    const id = document.getElementById('urunSelect')?.value;
    const miktar = Number(document.getElementById('islemMiktar')?.value);
    if (!id) return alert("Ürün seçin!");
    if (!miktar || miktar <= 0) return alert("Geçerli miktar girin!");
    const mevcut = stoklar[id]?.kalan || 0;
    const yeni = tip === 'giris' ? mevcut + miktar : mevcut - miktar;
    if (tip === 'cikis' && yeni < 0) return alert("Stok yetersiz!");
    const batch = writeBatch(db);
    batch.update(doc(db, "stoklar", id), { kalan: yeni });
    batch.set(doc(collection(db, "hareketler")), { urunId: id, urun: getUrunAdi(stoklar[id]), tur: tip, miktar, tarih: Timestamp.now() });
    await batch.commit();
    alert("İşlem tamam!");
    document.getElementById('islemMiktar').value = "";
};

window.urunSil = async (id) => {
    if (!yoneticiMi()) return alert("Yetkiniz yok!");
    if (confirm("Ürün silinsin mi?")) await deleteDoc(doc(db, "stoklar", id));
};

window.detayGoster = async (id) => {
    seciliUrunId = id;
    const u = stoklar[id];
    document.getElementById('modalUrunAd').value = getUrunAdi(u);
    document.getElementById('modalMiktar').value = u.kalan;
    document.getElementById('modalBarkod').value = u.barkod || "";
    document.getElementById('modalKritik').value = u.kritik || 5;
    document.getElementById('detayModal').style.display = 'block';
    try {
        const snap = await getDocs(query(collection(db, "hareketler"), where("urunId", "==", id), orderBy("tarih", "desc"), limit(10)));
        document.getElementById('detayIcerik').innerHTML = snap.empty ? "Hareket yok" : snap.docs.map(d => `<div>${d.data().tarih?.toDate().toLocaleString()} - ${d.data().tur}: ${d.data().miktar}</div>`).join('');
    } catch(e) { console.error(e); }
};

window.urunGuncelle = async () => {
    if (!yoneticiMi()) return alert("Yetkiniz yok!");
    await updateDoc(doc(db, "stoklar", seciliUrunId), {
        urunAd: document.getElementById('modalUrunAd').value,
        barkod: document.getElementById('modalBarkod').value,
        kalan: Number(document.getElementById('modalMiktar').value),
        kritik: Number(document.getElementById('modalKritik').value),
        grup: document.getElementById('modalGrup').value
    });
    alert("Güncellendi!");
    kapatModal();
};

window.kapatModal = () => document.getElementById('detayModal').style.display = 'none';

// ========== SEPET ==========
window.sepeteEkle = () => {
    const id = document.getElementById('urunSelect')?.value;
    const miktar = Number(document.getElementById('islemMiktar')?.value);
    if (!id) return alert("Ürün seçin!");
    if (!miktar || miktar <= 0) return alert("Geçerli miktar girin!");
    sepet.push({ id, ad: getUrunAdi(stoklar[id]), miktar });
    const liste = document.getElementById('sepetListesi');
    const butonlar = document.getElementById('sepetButonlar');
    liste.innerHTML = sepet.map((u, i) => `<div style="padding:8px; border-bottom:1px solid #eee; display:flex; justify-content:space-between;"><span><b>${u.ad}</b> x${u.miktar}</span><button onclick="sepetSil(${i})" style="background:#e74c3c; color:white; border:none; border-radius:5px; padding:5px 10px;">Sil</button></div>`).join('');
    butonlar.style.display = 'flex';
    document.getElementById('islemMiktar').value = "";
};

window.sepetSil = (i) => { sepet.splice(i, 1); sepetiGoster(); };
function sepetiGoster() {
    const liste = document.getElementById('sepetListesi');
    const butonlar = document.getElementById('sepetButonlar');
    if (sepet.length === 0) { liste.innerHTML = 'Sepet boş'; butonlar.style.display = 'none'; }
    else { liste.innerHTML = sepet.map((u, i) => `<div>${u.ad} x${u.miktar} <button onclick="sepetSil(${i})">Sil</button></div>`).join(''); butonlar.style.display = 'flex'; }
}

window.topluIslem = async (tip) => {
    if (sepet.length === 0) return alert("Sepet boş!");
    const batch = writeBatch(db);
    for (let item of sepet) {
        const mevcut = stoklar[item.id]?.kalan || 0;
        const yeni = tip === 'giris' ? mevcut + item.miktar : mevcut - item.miktar;
        if (tip === 'cikis' && mevcut < item.miktar) throw new Error(`${item.ad} için stok yetersiz!`);
        batch.update(doc(db, "stoklar", item.id), { kalan: yeni });
        batch.set(doc(collection(db, "hareketler")), { urunId: item.id, urun: item.ad, tur: tip, miktar: item.miktar, tarih: Timestamp.now() });
    }
    await batch.commit();
    alert("Toplu işlem başarılı!");
    sepet = [];
    sepetiGoster();
};

// ========== KAMERA ==========
let kameraAktif = false;
window.kameraBaslat = () => {
    const reader = document.getElementById("reader");
    const btn = document.getElementById("kameraAcBtn");
    if (kameraAktif) return;
    reader.style.display = "block";
    if (html5QrCode) html5QrCode.stop().catch(()=>{});
    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, (text) => {
        const select = document.getElementById('urunSelect');
        for (let i = 0; i < select.options.length; i++) {
            if (select.options[i].text === text || stoklar[select.options[i].value]?.barkod === text) {
                select.value = select.options[i].value;
                alert("Ürün bulundu: " + select.options[i].text);
                break;
            }
        }
    }, (err) => {}).then(() => {
        kameraAktif = true;
        btn.innerHTML = "❌ Kapat";
        btn.onclick = kameraDurdur;
    }).catch(e => alert("Kamera hatası: " + e));
};

window.kameraDurdur = () => {
    const reader = document.getElementById("reader");
    const btn = document.getElementById("kameraAcBtn");
    if (html5QrCode) html5QrCode.stop().catch(()=>{});
    reader.style.display = "none";
    kameraAktif = false;
    btn.innerHTML = "📷 Barkod Oku";
    btn.onclick = kameraBaslat;
};

window.yeniUrunKamera = () => {
    const reader = document.getElementById("reader");
    reader.style.display = "block";
    if (html5QrCode) html5QrCode.stop().catch(()=>{});
    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, (text) => {
        document.getElementById('urunBarkod').value = text;
        alert("Barkod okundu: " + text);
        kameraDurdur();
    }, (err) => {}).catch(e => alert("Kamera hatası: " + e));
};

document.getElementById("kameraAcBtn")?.addEventListener("click", kameraBaslat);
document.getElementById("yeniUrunKameraBtn")?.addEventListener("click", yeniUrunKamera);

// ========== RAPORLAMA ==========
window.raporOlustur = async () => {
    const baslangic = document.getElementById('raporBaslangic')?.value;
    const bitis = document.getElementById('raporBitis')?.value;
    if (!baslangic || !bitis) return alert("Tarih seçin!");
    const start = new Date(baslangic); start.setHours(0,0,0,0);
    const end = new Date(bitis); end.setHours(23,59,59,999);
    const filtre = document.getElementById('raporFiltre')?.value || 'hepsi';
    try {
        const snap = await getDocs(query(collection(db, "hareketler"), where("tarih", ">=", Timestamp.fromDate(start)), where("tarih", "<=", Timestamp.fromDate(end))));
        const data = {};
        snap.forEach(d => {
            const item = d.data();
            if (filtre !== "hepsi" && item.tur !== filtre) return;
            if (!data[item.urun]) data[item.urun] = { giris: 0, cikis: 0 };
            if (item.tur === 'giris') data[item.urun].giris += item.miktar;
            else data[item.urun].cikis += item.miktar;
        });
        const tbody = document.getElementById('raporTabloGovde');
        tbody.innerHTML = "";
        if (Object.keys(data).length === 0) tbody.innerHTML = '<tr><td colspan="3">Veri yok</td></tr>';
        else Object.entries(data).sort().forEach(([urun, val]) => tbody.innerHTML += `<tr><td style="text-align:left;">${urun}</td><td style="text-align:center">${val.giris}</td><td style="text-align:center">${val.cikis}</td></tr>`);
        document.getElementById('raporSonuc').style.display = 'block';
    } catch(e) { alert(e.message); }
};

window.excelIndir = () => {
    const ws = XLSX.utils.table_to_sheet(document.getElementById('raporTablo'));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rapor");
    XLSX.writeFile(wb, `rapor_${new Date().toISOString().slice(0,10)}.xlsx`);
};

window.pdfIndir = () => {
    const tablo = document.getElementById('raporTablo').cloneNode(true);
    const w = window.open('', '_blank');
    w.document.write(`<html><head><meta charset="UTF-8"><title>Rapor</title><style>body{font-family:Segoe UI,sans-serif;padding:20px} table{border-collapse:collapse;width:100%} th,td{border:1px solid #ddd;padding:8px} th{background:#3498db;color:white}</style></head><body><h1>Stok Raporu</h1><p>${new Date().toLocaleString('tr-TR')}</p>${tablo.outerHTML}</body></html>`);
    w.document.close();
    w.print();
};

window.siparisPDF = () => {
    const kritikler = Object.values(stoklar).filter(u => (u.kalan || 0) <= (u.kritik || 5));
    if (kritikler.length === 0) return alert("Kritik ürün yok!");
    const w = window.open('', '_blank');
    w.document.write(`<html><head><meta charset="UTF-8"><title>Sipariş</title><style>body{font-family:Segoe UI,sans-serif;padding:20px} table{border-collapse:collapse;width:100%} th,td{border:1px solid #ddd;padding:8px} th{background:#e74c3c;color:white}</style></head><body><h1>Sipariş Listesi</h1><p>${new Date().toLocaleString('tr-TR')}</p><table><thead><tr><th>Ürün</th><th>Stok</th><th>Kritik</th><th>Önerilen</th></tr></thead><tbody>${kritikler.map(u => `<tr><td style="text-align:left;">${getUrunAdi(u)}</td><td style="text-align:center">${u.kalan}</td><td style="text-align:center">${u.kritik}</td><td style="text-align:center">${Math.max(0, (u.kritik * 2) - u.kalan)}</td>)`).join('')}</tbody></table></body></html>`);
    w.document.close();
    w.print();
};

window.siparisYazdir = () => {
    const kritikler = Object.values(stoklar).filter(u => (u.kalan || 0) <= (u.kritik || 5));
    if (kritikler.length === 0) return alert("Kritik ürün yok!");
    const w = window.open('', '_blank');
    w.document.write(`<html><head><meta charset="UTF-8"><title>Sipariş</title><style>body{font-family:Segoe UI,sans-serif;padding:20px} table{border-collapse:collapse;width:100%} th,td{border:1px solid #ddd;padding:8px} th{background:#e74c3c;color:white}</style></head><body><h1>Sipariş Listesi</h1><p>${new Date().toLocaleString('tr-TR')}</p><table><thead><tr><th>Ürün</th><th>Stok</th><th>Kritik</th><th>Önerilen</th><tr></thead><tbody>${kritikler.map(u => `<tr><td style="text-align:left;">${getUrunAdi(u)}</td><td style="text-align:center">${u.kalan}</td><td style="text-align:center">${u.kritik}</td><td style="text-align:center">${Math.max(0, (u.kritik * 2) - u.kalan)}</td>)`).join('')}</tbody></table><script>window.print();<\/script></body></html>`);
    w.document.close();
};

window.tabloFiltrele = () => {
    const f = document.getElementById('aramaKutusu')?.value.toLowerCase() || "";
    document.querySelectorAll('#tablo tr').forEach(r => { if(r.classList.length === 0 || r.classList[0]?.startsWith('grup-')) r.style.display = ''; else r.style.display = r.innerText.toLowerCase().includes(f) ? '' : 'none'; });
};

window.grupToggle = (id) => {
    document.querySelectorAll(`.${id}`).forEach(r => { r.style.display = r.style.display === 'none' ? 'table-row' : 'none'; });
};

// Sekmeler
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        const tab = document.getElementById(this.dataset.tab);
        if(tab) tab.classList.add('active');
        this.classList.add('active');
    });
});