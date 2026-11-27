
import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:http/http.dart' as http;
import 'package:google_fonts/google_fonts.dart';
import 'dart:convert';

// Token dibaca dari GitHub Secrets saat Build, bukan ditulis langsung di sini
const String GROQ_API_KEY = String.fromEnvironment('GROQ_API_KEY', defaultValue: '');
const String ADMIN_EMAIL = "yadngapain@gmail.com";

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(
    options: const FirebaseOptions(
      apiKey: "AIzaSyALxIyjRR3Sh5_Mt_4X228tzgBkvNoWIsA",
      authDomain: "duniamuu.firebaseapp.com",
      projectId: "duniamuu",
      storageBucket: "duniamuu.firebasestorage.app",
      messagingSenderId: "51369340219",
      appId: "1:51369340219:web:5d7d22085123ca8614db1e",
    ),
  );
  runApp(const AdminApp());
}

class AdminApp extends StatelessWidget {
  const AdminApp({super.key});
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Duniamu Admin',
      theme: ThemeData.dark().copyWith(
        scaffoldBackgroundColor: const Color(0xFF0b1020),
        appBarTheme: const AppBarTheme(backgroundColor: Color(0xFF182140)),
        colorScheme: const ColorScheme.dark(primary: Color(0xFFff7a45), secondary: Color(0xFFffb347)),
        textTheme: GoogleFonts.outfitTextTheme(ThemeData.dark().textTheme),
        cardTheme: const CardTheme(color: Color(0xFF182140)),
      ),
      home: const AuthWrapper(),
    );
  }
}

class AuthWrapper extends StatefulWidget {
  const AuthWrapper({super.key});
  @override
  State<AuthWrapper> createState() => _AuthWrapperState();
}

class _AuthWrapperState extends State<AuthWrapper> {
  bool _loading = false;

  Future<void> _login() async {
    setState(() => _loading = true);
    try {
      final GoogleSignInAccount? googleUser = await GoogleSignIn().signIn();
      if (googleUser == null) { setState(() => _loading = false); return; }
      final GoogleSignInAuthentication googleAuth = await googleUser.authentication;
      final credential = GoogleAuthProvider.credential(
        accessToken: googleAuth.accessToken,
        idToken: googleAuth.idToken,
      );
      UserCredential userCred = await FirebaseAuth.instance.signInWithCredential(credential);
      
      if (userCred.user!.email != ADMIN_EMAIL) {
        await FirebaseAuth.instance.signOut();
        throw Exception("Akses Ditolak: Bukan Admin.");
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    }
    setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<User?>(
      stream: FirebaseAuth.instance.authStateChanges(),
      builder: (context, snapshot) {
        if (snapshot.hasData && snapshot.data!.email == ADMIN_EMAIL) {
          return const DashboardScreen();
        }
        return Scaffold(
          body: Center(
            child: _loading 
              ? const CircularProgressIndicator()
              : Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.admin_panel_settings, size: 100, color: Color(0xFFff7a45)),
                    const SizedBox(height: 20),
                    const Text('Duniamu Admin', style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    const Text('Panel Kontrol Website', style: TextStyle(color: Colors.white54)),
                    const SizedBox(height: 40),
                    ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                        backgroundColor: const Color(0xFFff7a45),
                        foregroundColor: Colors.black,
                      ),
                      onPressed: _login,
                      icon: const Icon(Icons.login),
                      label: const Text('Masuk dengan Google', style: TextStyle(fontWeight: FontWeight.bold)),
                    )
                  ],
                ),
          ),
        );
      },
    );
  }
}

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 4,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Admin Dashboard'),
          actions: [
            IconButton(
              icon: const Icon(Icons.logout),
              onPressed: () => FirebaseAuth.instance.signOut(),
            )
          ],
          bottom: const TabBar(
            isScrollable: true,
            indicatorColor: Color(0xFFff7a45),
            tabs: [
              Tab(text: "🤖 AI Novel", icon: Icon(Icons.auto_awesome)),
              Tab(text: "💸 Withdraw", icon: Icon(Icons.money)),
              Tab(text: "📚 Novel", icon: Icon(Icons.book)),
              Tab(text: "👥 User", icon: Icon(Icons.people)),
            ],
          ),
        ),
        body: const TabBarView(
          children: [
            AIGeneratorTab(),
            WithdrawalTab(),
            NovelsTab(),
            UsersTab(),
          ],
        ),
      ),
    );
  }
}

// ==========================================
// TAB 1: AI GENERATOR
// ==========================================
class AIGeneratorTab extends StatefulWidget {
  const AIGeneratorTab({super.key});
  @override
  State<AIGeneratorTab> createState() => _AIGeneratorTabState();
}

class _AIGeneratorTabState extends State<AIGeneratorTab> {
  final TextEditingController _promptCtrl = TextEditingController();
  bool _loading = false;
  String _status = '';

  Future<void> _generate() async {
    if (_promptCtrl.text.isEmpty) return;
    if (GROQ_API_KEY.isEmpty) {
      setState(() => _status = '❌ Error: GROQ_API_KEY tidak ditemukan. Pastikan GitHub Secrets sudah diatur.');
      return;
    }

    setState(() { _loading = true; _status = 'Menghubungi Groq AI...'; });
    
    try {
      final res = await http.post(
        Uri.parse("https://api.groq.com/openai/v1/chat/completions"),
        headers: {"Authorization": "Bearer $GROQ_API_KEY", "Content-Type": "application/json"},
        body: jsonEncode({
          "model": "llama3-70b-8192",
          "messages": [
            {"role": "system", "content": "Output JSON valid: {\"title\":\"...\",\"author\":\"...\",\"genre\":\"...\",\"synopsis\":\"...\",\"cover\":\"https://picsum.photos/seed/123/300/400\",\"chapters\":[{\"title\":\"...\",\"content\":\"<p>...</p>\"}]}. Tulis konten bab yang panjang dan seru."},
            {"role": "user", "content": _promptCtrl.text}
          ],
          "response_format": {"type": "json_object"}
        }),
      );
      
      final data = jsonDecode(res.body);
      final novel = jsonDecode(data['choices'][0]['message']['content']);

      setState(() => _status = 'Menyimpan ke Database...');

      final docRef = FirebaseFirestore.instance.collection('novels').doc();
      await docRef.set({
        'title': novel['title'], 'author': novel['author'],
        'genre': novel['genre'], 'synopsis': novel['synopsis'],
        'cover': novel['cover'], 'rating': 5.0,
        'chapters': novel['chapters'].length, 'free': true,
        'createdAt': DateTime.now().toIso8601String()
      });
      
      for(int i=0; i<novel['chapters'].length; i++) {
        await docRef.collection('chapters').doc('${i+1}').set({
          'title': novel['chapters'][i]['title'],
          'content': novel['chapters'][i]['content'],
          'order': i+1
        });
      }
      
      setState(() { _status = '✅ Sukses! Novel "${novel['title']}" ditambahkan.'; _loading = false; _promptCtrl.clear(); });
    } catch (e) {
      setState(() { _status = '❌ Error: $e'; _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text('Buat Novel Otomatis', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        const Text('Ketik instruksi, AI akan menulis novel + bab dan langsung menyimpannya ke website.', style: TextStyle(color: Colors.white54)),
        const SizedBox(height: 16),
        TextField(
          controller: _promptCtrl,
          maxLines: 4,
          decoration: const InputDecoration(
            hintText: 'Contoh: Buatkan novel bergenre Fantasi berjudul "Pedang Langit" beserta 3 bab.',
            border: OutlineInputBorder(),
            fillColor: Color(0xFF121a33), filled: true
          ),
        ),
        const SizedBox(height: 16),
        SizedBox(
          height: 50,
          child: ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFff7a45), foregroundColor: Colors.black),
            onPressed: _loading ? null : _generate,
            child: _loading ? const CircularProgressIndicator(color: Colors.black) : const Text('✨ Generate & Simpan', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          ),
        ),
        if (_status.isNotEmpty) ...[
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: const Color(0xFF182140), borderRadius: BorderRadius.circular(8), border: Border.all(color: Colors.white12)),
            child: Text(_status, style: TextStyle(color: _status.startsWith('✅') ? Colors.greenAccent : Colors.white70)),
          )
        ]
      ],
    );
  }
}

// ==========================================
// TAB 2: WITHDRAWALS
// ==========================================
class WithdrawalTab extends StatelessWidget {
  const WithdrawalTab({super.key});
  @override
  Widget build(BuildContext context) {
    return StreamBuilder<QuerySnapshot>(
      stream: FirebaseFirestore.instance.collection('withdrawals').where('status', isEqualTo: 'pending').snapshots(),
      builder: (context, snapshot) {
        if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
        if (snapshot.data!.docs.isEmpty) return const Center(child: Text('Tidak ada antrean withdraw.'));
        
        return ListView.builder(
          itemCount: snapshot.data!.docs.length,
          itemBuilder: (context, i) {
            final doc = snapshot.data!.docs[i];
            final w = doc.data() as Map<String, dynamic>;
            return Card(
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: ListTile(
                title: Text('${w['method']} - Rp${w['rupiah']}', style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFFffb347))),
                subtitle: Text('${w['email']}\nNama: ${w['accountName']} | No: ${w['accountNumber']}'),
                isThreeLine: true,
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton(icon: const Icon(Icons.check_circle, color: Colors.green, size: 32), onPressed: () async {
                      await FirebaseFirestore.instance.collection('withdrawals').doc(doc.id).update({'status': 'paid', 'processedAt': FieldValue.serverTimestamp()});
                    }),
                    IconButton(icon: const Icon(Icons.cancel, color: Colors.red, size: 32), onPressed: () async {
                      await FirebaseFirestore.instance.collection('users').doc(w['uid']).update({'coins': FieldValue.increment(w['coins'])});
                      await FirebaseFirestore.instance.collection('withdrawals').doc(doc.id).update({'status': 'rejected', 'processedAt': FieldValue.serverTimestamp()});
                    }),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }
}

// ==========================================
// TAB 3: NOVELS
// ==========================================
class NovelsTab extends StatelessWidget {
  const NovelsTab({super.key});
  @override
  Widget build(BuildContext context) {
    return StreamBuilder<QuerySnapshot>(
      stream: FirebaseFirestore.instance.collection('novels').snapshots(),
      builder: (context, snapshot) {
        if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
        return ListView.builder(
          itemCount: snapshot.data!.docs.length,
          itemBuilder: (context, i) {
            final doc = snapshot.data!.docs[i];
            final n = doc.data() as Map<String, dynamic>;
            return Card(
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              child: ListTile(
                leading: ClipRRect(borderRadius: BorderRadius.circular(4), child: Image.network(n['cover'] ?? '', width: 40, height: 60, fit: BoxFit.cover, errorBuilder: (c,o,s) => const Icon(Icons.book, size: 40))),
                title: Text(n['title'] ?? '', style: const TextStyle(fontWeight: FontWeight.bold)),
                subtitle: Text('${n['genre']} · ${n['chapters']} bab'),
                trailing: IconButton(
                  icon: const Icon(Icons.delete, color: Colors.red), 
                  onPressed: () {
                    showDialog(context: context, builder: (c) => AlertDialog(
                      title: const Text('Hapus Novel?'),
                      content: Text('Hapus "${n['title']}" secara permanen?'),
                      actions: [
                        TextButton(onPressed: () => Navigator.pop(c), child: const Text('Batal')),
                        TextButton(onPressed: () { FirebaseFirestore.instance.collection('novels').doc(doc.id).delete(); Navigator.pop(c); }, child: const Text('Hapus', style: TextStyle(color: Colors.red))),
                      ]
                    ));
                  }
                ),
              ),
            );
          },
        );
      },
    );
  }
}

// ==========================================
// TAB 4: USERS
// ==========================================
class UsersTab extends StatelessWidget {
  const UsersTab({super.key});
  @override
  Widget build(BuildContext context) {
    return StreamBuilder<QuerySnapshot>(
      stream: FirebaseFirestore.instance.collection('users').limit(50).snapshots(),
      builder: (context, snapshot) {
        if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
        return ListView.builder(
          itemCount: snapshot.data!.docs.length,
          itemBuilder: (context, i) {
            final doc = snapshot.data!.docs[i];
            final u = doc.data() as Map<String, dynamic>;
            return Card(
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              child: ListTile(
                leading: const CircleAvatar(backgroundColor: Color(0xFF121a33), child: Icon(Icons.person, color: Colors.white54)),
                title: Text(u['displayName'] ?? 'User Tanpa Nama'),
                subtitle: Text('${u['coins'] ?? 0} Koin'),
                trailing: IconButton(
                  icon: const Icon(Icons.add_circle, color: Colors.blue),
                  onPressed: () async {
                    await FirebaseFirestore.instance.collection('users').doc(doc.id).update({'coins': FieldValue.increment(1000)});
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('+1000 Koin ditambahkan')));
                  }
                ),
              ),
            );
          },
        );
      },
    );
  }
}
