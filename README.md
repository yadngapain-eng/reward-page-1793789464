# Duniamu - Halaman Reward

Website "Selesaikan Misi, Hasilkan" dengan Firebase Firestore sebagai backend data.

## Fitur
- Misi interaktif dari Firestore (settings/global)
- Klaim reward (collection claims)
- Menu withdraw (collection withdrawals) dengan riwayat
- Panel admin (nesahera.html): CRUD misi, metode withdraw, kelola klaim, proses withdraw
- Autentikasi: user anonim (Firebase Auth), admin via Email/Password + custom claim admin

## Struktur Firestore
- settings/global : missions[], payments[], slogan
- claims/{id} : userId, name, contact, paymentMethod, missions[], totalPoin, status, createdAt
- withdrawals/{id} : userId, amount, method, accountName, accountNumber, status, createdAt, processedAt, adminNote

## Deploy
1. Firestore Rules - deploy firestore.rules via Firebase CLI:
   firebase deploy --only firestore:rules --project duniamuu
2. Firebase Auth - aktifkan Anonymous (user) dan Email/Password (admin).
3. Custom claim admin - set untuk akun admin via Firebase Admin SDK (sekali di lokal):
   admin.auth().setCustomUserClaims("UID_ADMIN", { admin: true })
4. App Check - aktifkan di Firebase Console (reCAPTCHA v3 / Turnstile).
5. Cloudflare Pages - Connect repo, Framework preset None, Build output /.

## Catatan Keamanan
firebase-config.js berisi konfigurasi publik Firebase (apiKey bukan rahasia).
Keamanan data bergantung pada Firestore Security Rules, Firebase Auth, dan App Check.
Login admin lama (PIN admin123) sudah dihapus - jangan dikembalikan.
