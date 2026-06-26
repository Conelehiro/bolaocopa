import { useState, useEffect, useRef } from "react";

// ─── SUPABASE STORAGE ADAPTER ──────────────────────────────────────────────────
// Reads/writes a shared key-value table so ALL participants see the same data
// (users, matches, predictions) in real time, regardless of device or browser.
const SUPABASE_URL = "https://ggjjysldvldpshvilcnr.supabase.co";
const SUPABASE_KEY = "sb_publishable_O76sReUKmdK-6mUS5uohBA_BqqmS-wC";
const SUPABASE_HEADERS = {
  "Content-Type": "application/json",
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
};

const storage = {
  async get(key) {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/bolao_data?key=eq.${encodeURIComponent(key)}&select=key,value`,
        { headers: SUPABASE_HEADERS }
      );
      if (!res.ok) return null;
      const rows = await res.json();
      if (!rows.length) return null;
      return { key, value: rows[0].value };
    } catch { return null; }
  },
  async set(key, value) {
    try {
      // Check if the key already exists
      const checkRes = await fetch(
        `${SUPABASE_URL}/rest/v1/bolao_data?key=eq.${encodeURIComponent(key)}&select=key`,
        { headers: SUPABASE_HEADERS }
      );
      const existing = checkRes.ok ? await checkRes.json() : [];

      if (existing.length > 0) {
        // UPDATE
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/bolao_data?key=eq.${encodeURIComponent(key)}`,
          { method: "PATCH", headers: SUPABASE_HEADERS, body: JSON.stringify({ value }) }
        );
        if (!res.ok) return null;
      } else {
        // INSERT
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/bolao_data`,
          { method: "POST", headers: SUPABASE_HEADERS, body: JSON.stringify({ key, value }) }
        );
        if (!res.ok) return null;
      }
      return { key, value };
    } catch { return null; }
  },
};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const PHASE_MULTIPLIERS = {
  "Fase de Grupos": 1,
  "Segunda Fase": 2,
  "Oitavas de Final": 4,
  "Quartas de Final": 8,
  "Semifinal": 16,
  "Disputa 3º Lugar": 16,
  "Final": 32,
};
const BASE_POINTS = { exact: 10, winner: 5 };
const LOCK_MINUTES_BEFORE = 10;
const NOTIFY_MINUTES_BEFORE = 30;
const BACKUP_INDEX_KEY = "bolao:backup:index";
const AWARD_BONUS_POINTS = 150;

const INITIAL_MATCHES = [
  // ── Fase de Grupos (horários em UTC; convertidos automaticamente para o fuso de cada usuário) ──
  { id: 1,  phase: "Fase de Grupos", group: "A", date: "2026-06-11", time: "15:00", home: "🇺🇸 EUA",       away: "🇲🇽 México",      homeScore: null, awayScore: null, stadium: "MetLife Stadium" },
  { id: 2,  phase: "Fase de Grupos", group: "A", date: "2026-06-11", time: "18:00", home: "🇨🇦 Canadá",   away: "🇨🇴 Colômbia",    homeScore: null, awayScore: null, stadium: "BMO Field" },
  { id: 3,  phase: "Fase de Grupos", group: "B", date: "2026-06-12", time: "15:00", home: "🇧🇷 Brasil",   away: "🇩🇪 Alemanha",    homeScore: null, awayScore: null, stadium: "SoFi Stadium" },
  { id: 4,  phase: "Fase de Grupos", group: "B", date: "2026-06-12", time: "18:00", home: "🇦🇷 Argentina",away: "🇫🇷 França",      homeScore: null, awayScore: null, stadium: "Rose Bowl" },
  { id: 5,  phase: "Fase de Grupos", group: "C", date: "2026-06-13", time: "15:00", home: "🇪🇸 Espanha",  away: "🏴 Inglaterra",   homeScore: null, awayScore: null, stadium: "AT&T Stadium" },
  { id: 6,  phase: "Fase de Grupos", group: "C", date: "2026-06-13", time: "18:00", home: "🇵🇹 Portugal", away: "🇳🇱 Holanda",    homeScore: null, awayScore: null, stadium: "Levi's Stadium" },
  { id: 7,  phase: "Fase de Grupos", group: "D", date: "2026-06-14", time: "15:00", home: "🇯🇵 Japão",    away: "🇸🇦 Arábia",     homeScore: null, awayScore: null, stadium: "Mercedes-Benz Stadium" },
  { id: 8,  phase: "Fase de Grupos", group: "D", date: "2026-06-14", time: "18:00", home: "🇲🇦 Marrocos", away: "🇸🇳 Senegal",    homeScore: null, awayScore: null, stadium: "Estadio Azteca" },
  { id: 9,  phase: "Fase de Grupos", group: "E", date: "2026-06-15", time: "15:00", home: "🇧🇷 Brasil",   away: "🇨🇴 Colômbia",   homeScore: null, awayScore: null, stadium: "Hard Rock Stadium" },
  { id: 10, phase: "Fase de Grupos", group: "E", date: "2026-06-15", time: "18:00", home: "🇩🇪 Alemanha", away: "🇨🇦 Canadá",     homeScore: null, awayScore: null, stadium: "Gillette Stadium" },
  // ── Segunda Fase ──
  { id: 51, phase: "Segunda Fase", group: null, date: "2026-06-27", time: "15:00", home: "🏆 1º Grupo A", away: "🥈 2º Grupo C", homeScore: null, awayScore: null, stadium: "MetLife Stadium" },
  { id: 52, phase: "Segunda Fase", group: null, date: "2026-06-27", time: "19:00", home: "🏆 1º Grupo B", away: "🥈 2º Grupo D", homeScore: null, awayScore: null, stadium: "SoFi Stadium" },
  { id: 53, phase: "Segunda Fase", group: null, date: "2026-06-28", time: "15:00", home: "🏆 1º Grupo C", away: "🥈 2º Grupo A", homeScore: null, awayScore: null, stadium: "Rose Bowl" },
  { id: 54, phase: "Segunda Fase", group: null, date: "2026-06-28", time: "19:00", home: "🏆 1º Grupo D", away: "🥈 2º Grupo B", homeScore: null, awayScore: null, stadium: "AT&T Stadium" },
  { id: 55, phase: "Segunda Fase", group: null, date: "2026-06-29", time: "15:00", home: "🏆 1º Grupo E", away: "🥈 2º Grupo F", homeScore: null, awayScore: null, stadium: "Levi's Stadium" },
  { id: 56, phase: "Segunda Fase", group: null, date: "2026-06-29", time: "19:00", home: "🏆 1º Grupo F", away: "🥈 2º Grupo E", homeScore: null, awayScore: null, stadium: "Hard Rock Stadium" },
  // ── Oitavas de Final ──
  { id: 101, phase: "Oitavas de Final", group: null, date: "2026-07-04", time: "16:00", home: "🏆 Vencedor SF1", away: "🏆 Vencedor SF2", homeScore: null, awayScore: null, stadium: "MetLife Stadium" },
  { id: 102, phase: "Oitavas de Final", group: null, date: "2026-07-04", time: "20:00", home: "🏆 Vencedor SF3", away: "🏆 Vencedor SF4", homeScore: null, awayScore: null, stadium: "SoFi Stadium" },
  { id: 103, phase: "Oitavas de Final", group: null, date: "2026-07-05", time: "16:00", home: "🏆 Vencedor SF5", away: "🏆 Vencedor SF6", homeScore: null, awayScore: null, stadium: "Rose Bowl" },
  { id: 104, phase: "Oitavas de Final", group: null, date: "2026-07-05", time: "20:00", home: "🏆 Vencedor SF7", away: "🏆 Vencedor SF8", homeScore: null, awayScore: null, stadium: "AT&T Stadium" },
  // ── Quartas de Final ──
  { id: 201, phase: "Quartas de Final", group: null, date: "2026-07-09", time: "20:00", home: "🏆 Vencedor OI1", away: "🏆 Vencedor OI2", homeScore: null, awayScore: null, stadium: "MetLife Stadium" },
  { id: 202, phase: "Quartas de Final", group: null, date: "2026-07-10", time: "20:00", home: "🏆 Vencedor OI3", away: "🏆 Vencedor OI4", homeScore: null, awayScore: null, stadium: "SoFi Stadium" },
  // ── Semifinal ──
  { id: 301, phase: "Semifinal", group: null, date: "2026-07-14", time: "20:00", home: "🏆 Vencedor QF1", away: "🏆 Vencedor QF2", homeScore: null, awayScore: null, stadium: "MetLife Stadium" },
  { id: 302, phase: "Semifinal", group: null, date: "2026-07-15", time: "20:00", home: "🏆 Vencedor QF3", away: "🏆 Vencedor QF4", homeScore: null, awayScore: null, stadium: "Rose Bowl" },
  // ── Disputa 3º Lugar ──
  { id: 350, phase: "Disputa 3º Lugar", group: null, date: "2026-07-18", time: "16:00", home: "🏆 Perdedor SF1", away: "🏆 Perdedor SF2", homeScore: null, awayScore: null, stadium: "AT&T Stadium" },
  // ── Final ──
  { id: 401, phase: "Final", group: null, date: "2026-07-19", time: "20:00", home: "🏆 Semifinalista 1", away: "🏆 Semifinalista 2", homeScore: null, awayScore: null, stadium: "MetLife Stadium" },
];

// ─── UTILS ────────────────────────────────────────────────────────────────────
function matchDateTime(m) {
  // Datas/horários já são convertidos e armazenados no horário de Brasília (UTC-3).
  return new Date(`${m.date}T${m.time}:00-03:00`);
}
function minutesUntilMatch(m) {
  return (matchDateTime(m) - Date.now()) / 60000;
}
function isLocked(m) {
  return minutesUntilMatch(m) <= LOCK_MINUTES_BEFORE;
}
function hasPred(pred) {
  return pred && pred.home !== undefined && pred.home !== "" && pred.away !== undefined && pred.away !== "";
}
function calcPoints(pred, real, phase) {
  if (!hasPred(pred) || real.homeScore === null) return 0;
  const mult = PHASE_MULTIPLIERS[phase] || 1;
  if (Number(pred.home) === real.homeScore && Number(pred.away) === real.awayScore) return BASE_POINTS.exact * mult;
  const pw = Number(pred.home) > Number(pred.away) ? "H" : Number(pred.home) < Number(pred.away) ? "A" : "D";
  const rw = real.homeScore > real.awayScore ? "H" : real.homeScore < real.awayScore ? "A" : "D";
  if (pw === rw) return BASE_POINTS.winner * mult;
  return 0;
}
function getResultLabel(pts, phase) {
  const mult = PHASE_MULTIPLIERS[phase] || 1;
  if (pts === 10 * mult) return { label: "🎯 Placar Cravado!", color: "#00e676" };
  if (pts === 5 * mult)  return { label: "✅ Acertou Resultado", color: "#ffeb3b" };
  return { label: "❌ Errou", color: "#ef5350" };
}
// As escolhas de Artilheiro/Garçom fecham quando a Segunda Fase terminar
// (todos os jogos dessa fase já têm placar). Se a Copa não tiver Segunda Fase
// cadastrada ainda, as escolhas continuam abertas.
function areAwardPicksLocked(matches) {
  const segunda = matches.filter(m => m.phase === "Segunda Fase");
  if (segunda.length === 0) return false;
  return segunda.every(m => m.homeScore !== null);
}
// O admin só pode preencher o Artilheiro/Garçom reais depois que a Copa
// terminar de verdade — quando a Final já tiver placar registrado.
function isCupFinished(matches) {
  const final = matches.filter(m => m.phase === "Final");
  if (final.length === 0) return false;
  return final.every(m => m.homeScore !== null);
}
function hashPassword(str) {
  // Simple deterministic hash for demo (not cryptographic)
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0; }
  return h.toString(36);
}
function formatCountdown(mins) {
  if (mins <= 0) return "Encerrado";
  if (mins < 60) return `${Math.floor(mins)}min`;
  const h = Math.floor(mins / 60), m = Math.floor(mins % 60);
  return `${h}h ${m}min`;
}
function formatBackupDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR") + " às " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// ─── AI FETCH ─────────────────────────────────────────────────────────────────
// ─── COUNTRY → FLAG EMOJI MAP ─────────────────────────────────────────────────
const FLAGS = {
  "Mexico": "🇲🇽", "South Africa": "🇿🇦", "South Korea": "🇰🇷", "Czech Republic": "🇨🇿",
  "Canada": "🇨🇦", "Qatar": "🇶🇦", "Switzerland": "🇨🇭", "Brazil": "🇧🇷", "Morocco": "🇲🇦",
  "Haiti": "🇭🇹", "Scotland": "🏴", "USA": "🇺🇸", "Paraguay": "🇵🇾", "Australia": "🇦🇺",
  "Germany": "🇩🇪", "Curaçao": "🇨🇼", "Ivory Coast": "🇨🇮", "Ecuador": "🇪🇨",
  "Netherlands": "🇳🇱", "Japan": "🇯🇵", "Tunisia": "🇹🇳", "Belgium": "🇧🇪", "Egypt": "🇪🇬",
  "Iran": "🇮🇷", "New Zealand": "🇳🇿", "Spain": "🇪🇸", "Cape Verde": "🇨🇻",
  "Saudi Arabia": "🇸🇦", "Uruguay": "🇺🇾", "France": "🇫🇷", "Senegal": "🇸🇳", "Norway": "🇳🇴",
  "Argentina": "🇦🇷", "Algeria": "🇩🇿", "Austria": "🇦🇹", "Jordan": "🇯🇴", "Portugal": "🇵🇹",
  "Uzbekistan": "🇺🇿", "Colombia": "🇨🇴", "England": "🏴", "Croatia": "🇭🇷",
  "Ghana": "🇬🇭", "Panama": "🇵🇦",
  // grafias usadas na planilha de elencos (SquadLists)
  "Bosnia and Herzegovina": "🇧🇦", "Cabo Verde": "🇨🇻", "Congo DR": "🇨🇩",
  "Cote d'Ivoire": "🇨🇮", "Curacao": "🇨🇼", "Czechia": "🇨🇿", "IR Iran": "🇮🇷",
  "Iraq": "🇮🇶", "Korea Republic": "🇰🇷", "Sweden": "🇸🇪", "Turkiye": "🇹🇷",
};

// ─── NOMES DOS PAÍSES EM PORTUGUÊS (BR) ───────────────────────────────────────
const NAMES_PT = {
  "Mexico": "México", "South Africa": "África do Sul", "South Korea": "Coreia do Sul",
  "Korea Republic": "Coreia do Sul", "Czech Republic": "República Tcheca",
  "Canada": "Canadá", "Qatar": "Catar", "Switzerland": "Suíça", "Brazil": "Brasil",
  "Morocco": "Marrocos", "Haiti": "Haiti", "Scotland": "Escócia", "USA": "Estados Unidos",
  "United States": "Estados Unidos", "Paraguay": "Paraguai", "Australia": "Austrália",
  "Germany": "Alemanha", "Curaçao": "Curaçao", "Ivory Coast": "Costa do Marfim",
  "Côte d'Ivoire": "Costa do Marfim", "Ecuador": "Equador", "Netherlands": "Holanda",
  "Japan": "Japão", "Tunisia": "Tunísia", "Belgium": "Bélgica", "Egypt": "Egito",
  "Iran": "Irã", "IR Iran": "Irã", "New Zealand": "Nova Zelândia", "Spain": "Espanha",
  "Cape Verde": "Cabo Verde", "Saudi Arabia": "Arábia Saudita", "Uruguay": "Uruguai",
  "France": "França", "Senegal": "Senegal", "Norway": "Noruega", "Argentina": "Argentina",
  "Algeria": "Argélia", "Austria": "Áustria", "Jordan": "Jordânia", "Portugal": "Portugal",
  "Uzbekistan": "Uzbequistão", "Colombia": "Colômbia", "England": "Inglaterra",
  "Croatia": "Croácia", "Ghana": "Gana", "Panama": "Panamá",
  // extras comuns
  "Italy": "Itália", "Poland": "Polônia", "Denmark": "Dinamarca", "Sweden": "Suécia",
  "Turkey": "Turquia", "Türkiye": "Turquia", "Greece": "Grécia", "Serbia": "Sérvia",
  "Nigeria": "Nigéria", "Cameroon": "Camarões", "Peru": "Peru", "Chile": "Chile",
  "Costa Rica": "Costa Rica", "Wales": "País de Gales", "Ukraine": "Ucrânia",
  "Russia": "Rússia", "China": "China", "India": "Índia", "Israel": "Israel",
  // grafias usadas na planilha de elencos (SquadLists)
  "Bosnia and Herzegovina": "Bósnia e Herzegovina", "Cabo Verde": "Cabo Verde",
  "Congo DR": "Rep. Dem. do Congo", "Cote d'Ivoire": "Costa do Marfim",
  "Curacao": "Curaçao", "Czechia": "República Tcheca", "Iraq": "Iraque",
  "Turkiye": "Turquia",
};

function flagify(team) {
  if (!team) return team;
  const flag = FLAGS[team];
  const name = NAMES_PT[team] || team;
  return flag ? `${flag} ${name}` : `🏆 ${name}`;
}

// ─── ELENCOS DA COPA (planilha SquadLists) ────────────────────────────────────
// Lista completa de atletas convocados por seleção. Usada no autocomplete de
// Artilheiro/Garçom: agora o jogador e a seleção são cadastrados aqui no sistema,
// em vez de buscados de uma API externa.
const SQUADS = {
  "Algeria": ["Mastil Melvin", "Mandi Aissa", "Abada Achref", "Tougai Mohamed Amine", "Belaid Zineddine", "Zerrouki Ramiz", "Mahrez Riyad", "Aouar Houssem", "Gouiri Amine", "Chaibi Fares", "Hadj Moussa Anis", "Benbouali Nadhir", "Hadjam Jaouen", "Boudaoui Hicham", "Ait-Nouri Rayan", "Benbot Oussama", "Belghali Rak", "Amoura Mohamed", "Bentaleb Nabil", "Boulbina Adil", "Bensebaini Ramy", "Maza Ibrahim", "Zidane Luca", "Titraoui Yassine", "Ghedjemis Fares", "Chergui Samir"],
  "Argentina": ["Musso Juan", "Senesi Marcos", "Tagliafico Nicolas", "Montiel Gonzalo", "Paredes Leandro", "Martinez Lisandro", "De Paul Rodrigo", "Barco Valentin", "Alvarez Julian", "Messi Lionel", "Lo Celso Giovani", "Rulli Geronimo", "Romero Cristian", "Palacios Exequiel", "Gonzalez Nico", "Almada Thiago", "Simeone Giuliano", "Paz Nico", "Otamendi Nicolas", "Mac Allister Alexis", "Lopez Jose Manuel", "Martinez Lautaro", "Martinez Emiliano", "Fernandez Enzo", "Medina Facundo", "Molina Nahuel"],
  "Australia": ["Ryan Mathew", "Degenek Milos", "Circati Alessandro", "Italiano Jacob", "Bos Jordan", "Geria Jason", "Leckie Mathew", "Metcalfe Connor", "Toure Mohamed", "Hrustic Ajdin", "Mabil Awer", "Izzo Paul", "Oneill Aiden", "Devlin Cameron", "Trewin Kai", "Behich Aziz", "Irankunda Nestory", "Beach Patrick", "Souttar Harry", "Volpato Cristian", "Burgess Cameron", "Irvine Jackson", "Velupillay Nishan", "Okon-Engstler Paul", "Herrington Lucas", "Yengi Tete"],
  "Austria": ["Schlager Alexander", "Affengruber David", "Danso Kevin", "Schlager Xaver", "Posch Stefan", "Seiwald Nicolas", "Arnautovic Marko", "Alaba David", "Sabitzer Marcel", "Grillitsch Florian", "Gregoritsch Michael", "Wiegele Florian", "Pentz Patrick", "Kalajdzic Sasa", "Lienhart Philipp", "Mwene Phillip", "Chukwuemeka Carney", "Schmid Romano", "Ljubicic Dejan", "Laimer Konrad", "Wimmer Patrick", "Prass Alexander", "Friedl Marco", "Wanner Paul", "Svoboda Michael", "Schoepf Alessandro"],
  "Belgium": ["Courtois Thibaut", "Debast Zeno", "Theate Arthur", "Mechele Brandon", "De Cuyper Maxim", "Witsel Axel", "De Bruyne Kevin", "Tielemans Youri", "Lukaku Romelu", "Trossard Leandro", "Doku Jeremy", "Lammens Senne", "Penders Mike", "Lukebakio Dodi", "Meunier Thomas", "De Winter Koni", "De Ketelaere Charles", "Seys Joaquin", "Moreira Diego", "Vanaken Hans", "Castagne Timothy", "Saelemaekers Alexis", "Raskin Nicolas", "Onana Amadou", "Ngoy Nathan", "Fernandez-Pardo Matias"],
  "Bosnia and Herzegovina": ["Vasilj Nikola", "Mujakic Nihad", "Hadzikadunic Dennis", "Muharemovic Tarik", "Kolasinac Sead", "Tahirovic Benjamin", "Dedic Amar", "Gigovic Armin", "Bazdar Samed", "Demirovic Ermedin", "Dzeko Edin", "Jurkas Mladen", "Basic Ivan", "Sunjic Ivan", "Memic Amar", "Hadziahmetovic Amir", "Burnic Dzenis", "Katic Nikola", "Alajbegovic Kerim", "Bajraktarevic Esmir", "Radeljic Stjepan", "Zlomislic Martin", "Tabakovic Haris", "Malic Arjan", "Lukic Jovo", "Mahmic Ermin"],
  "Brazil": ["Alisson", "Ederson Silva", "Gabriel Magalhaes", "Marquinhos", "Casemiro", "Alex Sandro", "Vinicius Junior", "Bruno Guimaraes", "Matheus Cunha", "Neymar Jr", "Raphinha", "Weverton", "Danilo", "Bremer", "Leo Pereira", "Douglas Santos", "Fabinho", "Danilo Santos", "Endrick", "Lucas Paqueta", "Luiz Henrique", "Gabriel Martinelli", "Ederson", "Roger Ibanez", "Igor Thiago", "Rayan"],
  "Cabo Verde": ["Vozinha", "Stopira", "Diney Borges", "Pico Lopes", "Logan Costa", "Kevin Pina", "Jovane Cabral", "Joao Paulo", "Gilson Benchimol", "Jamiro Monteiro", "Garry Rodrigues", "Marcio Rosa", "Sidny Lopes Cabral", "Deroy Duarte", "Laros Duarte", "Yannick Semedo", "Willy Semedo", "Telmo Arcanjo", "Dailon Livramento", "Ryan Mendes", "Nuno Da Costa", "Steven Moreira", "Cj Dos Santos", "Wagner Pina", "Kelvin Pires", "Helio Varela"],
  "Canada": ["St. Clair Dayne", "Johnston Alistair", "Jones Ale", "De Fougerolles Luc", "Waterman Joel", "Choiniere Mathieu", "Eustaquio Stephen", "Kone Ismael", "Larin Cyle", "David Jonathan", "Millar Liam", "Oluwaseyi Tani", "Cornelius Derek", "Shaffelburg Jacob", "Bombito Moise", "Crepeau Maxime", "Buchanan Tajon", "Goodman Owen", "Davies Alphonso", "Ahmed Ali", "Osorio Jonathan", "Laryea Richie", "Sigur Niko", "David Promise", "Saliba Nathan", "Nelson Jayden"],
  "Colombia": ["Ospina David", "Munoz Daniel", "Lucumi Jhon", "Arias Santiago", "Castano Kevin", "Rios Richard", "Diaz Luis", "Carrascal Jorge", "Cordoba Jhon", "Rodriguez James", "Arias Jhon", "Vargas Camilo", "Mina Yerry", "Puerta Gustavo", "Portilla Juan", "Lerma Jefferson", "Mojica Johan", "Ditta Willer", "Hernandez Cucho", "Quintero Juan", "Campaz Jaminton", "Machado Deiver", "Sanchez Davinson", "Montero Alvaro", "Suarez Luis", "Gomez Andres"],
  "Congo DR": ["Mpasi Lionel", "Wan-Bissaka Aaron", "Kapuadi Steve", "Tuanzebe Axel", "Batubinsika Dylan", "Mukau Ngalayel", "Mbuku Nathanael", "Moutoussamy Samuel", "Cipenga Brian", "Bongonda Theo", "Kakuta Gael", "Kayembe Joris", "Elia Meschack", "Sadiki Noah", "Tshibola Aaron", "Fayulu Timothy", "Bakambu Cedric", "Pickel Charles", "Mayele Fiston", "Wissa Yoane", "Epolo Matthieu", "Mbemba Chancel", "Banza Simon", "Kalulu Gedeon", "Kayembe Edo", "Masuaku Arthur"],
  "Cote d'Ivoire": ["Fofana Yahia", "Diomande Ousmane", "Konan Ghislain", "Seri Jean Michael", "Singo Wilfried", "Fofana Seko", "Kossounou Odilon", "Kessie Franck", "Bonny Ange-Yoan", "Adingra Simon", "Diomande Yan", "Wahi Elye", "Operi Christopher", "Diakite Oumar", "Diallo Amad", "Kone Mohamed", "Doue Guela", "Sangare Ibrahim", "Pepe Nicolas", "Agbadou Emmanuel", "Ndicka Evan", "Guessand Evann", "Lafont Alban", "Toure Bazoumana", "Guiagon Parfait", "Oulai Christ Inao"],
  "Croatia": ["Livakovic Dominik", "Stanisic Josip", "Pongracic Marin", "Gvardiol Josko", "Caleta-Car Duje", "Sutalo Josip", "Moro Nikola", "Kovacic Mateo", "Kramaric Andrej", "Modric Luka", "Budimir Ante", "Pandur Ivor", "Vlasic Nikola", "Perisic Ivan", "Pasalic Mario", "Baturina Martin", "Sucic Petar", "Jakic Kristijan", "Fruk Toni", "Matanovic Igor", "Sucic Luka", "Vuskovic Luka", "Kotarski Dominik", "Pasalic Marco", "Erlic Martin", "Musa Petar"],
  "Curacao": ["Room Eloy", "Sambo Shurandy", "Gaari Jurien", "Van Eijma Roshon", "Floranus Sherel", "Roemeratoe Godfried", "Bacuna Juninho", "Comenencia Livano", "Locadia Juergen", "Bacuna Leandro", "Antonisse Jeremy", "Hansen Sontje", "Noslin Tyrese", "Gorre Kenji", "Martha Arjany", "Margaritha Jearl", "Kuwas Brandley", "Obispo Armando", "Kastaneer Gervane", "Brenet Joshua", "Chong Tahith", "Felida Kevin", "Bazoer Riechedly", "Fonville Deveron", "Bodak Tyrick", "Doornbusch Trevor"],
  "Czechia": ["Kovar Matej", "Zima David", "Holes Tomas", "Hranac Robin", "Coufal Vladimir", "Chaloupek Stepan", "Krejci Ladislav", "Darida Vladimir", "Hlozek Adam", "Schick Patrik", "Kuchta Jan", "Cerv Lukas", "Chytil Mojmir", "Jurasek David", "Sulc Pavel", "Stanek Jindrich", "Provod Lukas", "Sadilek Michal", "Chory Tomas", "Zeleny Jaroslav", "Doudera David", "Soucek Tomas", "Hornicek Lukas", "Sojka Alexandr", "Sochurek Hugo", "Visinsky Denis"],
  "Ecuador": ["Galindez Hernan", "Torres Felix", "Hincapie Piero", "Ordonez Joel", "Alcivar Jordy", "Pacho Willian", "Estupinan Pervis", "Valencia Anthony", "Yeboah John", "Paez Kendry", "Rodriguez Kevin", "Ramirez Moises", "Valencia Enner", "Minda Alan", "Vite Pedro", "Caicedo Jordy", "Preciado Angelo", "Castillo Denil", "Plata Gonzalo", "Angulo Nilson", "Franco Alan", "Valle Gonzalo", "Caicedo Moises", "Arevalo Jeremy", "Porozo Jackson", "Medina Yaimar"],
  "Egypt": ["Mohamed Elshenawy", "Yasser Ibrahim", "Mohamed Hany", "Hossam Abdelmaguid", "Ramy Rabia", "Mohamed Abdelmoneim", "Trezeguet", "Emam Ashour", "Hamza Abdelkarim", "Mohamed Salah", "Mostafa Zico", "Haissem Hassan", "Ahmed Fatouh", "Hamdy Fathy", "Karim Hafez", "Mahdy Soliman", "Mohanad Lashin", "Nabil Donga", "Marawan Attia", "Ibrahim Adel", "Mahmoud Saber", "Omar Marmoush", "Mostafa Shoubir", "Tarek Alaa", "Zizo", "Mohamed Alaa"],
  "England": ["Pickford Jordan", "Konsa Ezri", "Oreilly Nico", "Rice Declan", "Stones John", "Guehi Marc", "Saka Bukayo", "Anderson Elliot", "Kane Harry", "Bellingham Jude", "Rashford Marcus", "Chalobah Trevoh", "Henderson Dean", "Henderson Jordan", "Burn Dan", "Mainoo Kobbie", "Rogers Morgan", "Gordon Anthony", "Watkins Ollie", "Madueke Noni", "Eze Eberechi", "Toney Ivan", "Trafford James", "James Reece", "Spence Djed", "Quansah Jarell"],
  "France": ["Samba Brice", "Gusto Malo", "Digne Lucas", "Upamecano Dayot", "Kounde Jules", "Kone Manu", "Dembele Ousmane", "Tchouameni Aurelien", "Thuram Marcus", "Mbappe Kylian", "Olise Michael", "Barcola Bradley", "Kante Ngolo", "Rabiot Adrien", "Konate Ibrahima", "Maignan Mike", "Saliba William", "Zaire-Emery Warren", "Hernandez Theo", "Doue Desire", "Hernandez Lucas", "Mateta Jean-Philippe", "Risser Robin", "Cherki Rayan", "Akliouche Maghnes", "Lacroix Maxence"],
  "Germany": ["Neuer Manuel", "Ruediger Antonio", "Anton Waldemar", "Tah Jonathan", "Pavlovic Aleksandar", "Kimmich Joshua", "Havertz Kai", "Goretzka Leon", "Leweling Jamie", "Musiala Jamal", "Woltemade Nick", "Baumann Oliver", "Gross Pascal", "Beier Maximilian", "Schlotterbeck Nico", "Stiller Angelo", "Wirtz Florian", "Brown Nathaniel", "Sane Leroy", "Amiri Nadiem", "Nuebel Alexander", "Raum David", "Nmecha Felix", "Thiaw Malick", "Ouedraogo Assan", "Undav Deniz"],
  "Ghana": ["Zigi Lawrence Ati", "Seidu Alidu", "Yirenkyi Caleb", "Adjetey Jonas", "Partey Thomas", "Mumin Abdul", "Fatawu Abdul", "Sibo Kwasi", "Ayew Jordan", "Thomas-Asante Brandon", "Semenyo Antoine", "Anang Joseph", "Bonsu Baah Christopher", "Mensah Gideon", "Owusu Elisha", "Asare Benjamin", "Rahman Baba", "Opoku Jerome", "Williams Inaki", "Boakye Augustine", "Oppong Kojo Peprah", "Sulemana Kamaldeen", "Luckassen Derrick", "Nuamah Ernest", "Adu Prince", "Senaya Marvin"],
  "Haiti": ["Placide Johny", "Arcus Carlens", "Thermoncy Keeto", "Ade Ricardo", "Delcroix Hannes", "Sainte Carl", "Etienne Derrick", "Experience Martin", "Nazon Duckens", "Bellegarde Jean-Ricner", "Deedson Louicius", "Pierre Alexandre", "Lacroix Markhus", "Metusala Garven", "Providence Ruben", "Joseph Lenny", "Jean Jacques Danley", "Isidor Wilson", "Fortune Yassin", "Pierrot Frantzdy", "Casimir Josue", "Duverne Jean-Kevin", "Duverger Josue", "Paugain Wilguens", "Simon Dominique", "Pierre Woodensky"],
  "IR Iran": ["Beiranvand Alireza", "Hardani Saleh", "Hajisafi Ehsan", "Khalilzadeh Shoja", "Mohammadi Milad", "Ezatolahi Saeid", "Jahanbakhsh Alireza", "Mohebbi Mohammad", "Taremi Mehdi", "Ghayedi Mehdi", "Alipour Ali", "Niazmand Payam", "Kanani Hossein", "Ghoddos Saman", "Cheshmi Roozbeh", "Torabi Mehdi", "Yousefi Arya", "Hosseinzadeh Amirhossein", "Nemati Ali", "Moghanloo Shahriyar", "Ghorbani Mohammad", "Hosseini Hossein", "Rezaeian Ramin", "Dargahi Dennis", "Iri Danial", "Razaghinia Amirmohammad"],
  "Iraq": ["Fahad Talib", "Rebin Sulaka", "Hussein Ali", "Zaid Tahseen", "Akam Hashim", "Munaf Younus", "Youssef Amyn", "Ibrahim Bayesh", "Ali Alhamadi", "Mohanad Ali", "Ahmed Qasem", "Jalal Hassan", "Ali Yousif", "Zidane Iqbal", "Ahmed Maknazi", "Amir Alammari", "Ali Jasim", "Aymen Hussein", "Kevin Yakob", "Aimar Sher", "Marko Farji", "Ahmed Basil", "Merchas Doski", "Zaid Ismael", "Mustafa Saadoon", "Frans Putros"],
  "Japan": ["Suzuki Zion", "Sugawara Yukinari", "Taniguchi Shogo", "Itakura Kou", "Nagatomo Yuto", "Machino Shuto", "Tanaka Ao", "Kubo Takefusa", "Goto Keisuke", "Doan Ritsu", "Maeda Daizen", "Osako Keisuke", "Nakamura Keito", "Ito Junya", "Kamada Daichi", "Watanabe Tsuyoshi", "Suzuki Yuito", "Ueda Ayase", "Ogawa Koki", "Seko Ayumu", "Ito Hiroki", "Tomiyasu Takehiro", "Hayakawa Tomoki", "Sano Kaishu", "Suzuki Junnosuke", "Shiogai Kento"],
  "Jordan": ["Yazeed Abulaila", "Mohammad Abuhasheesh", "Abdallah Nasib", "Husam Abudahab", "Yazan Alarab", "Amer Jamous", "Mohammad Abuzraiq", "Noor Alrawabdeh", "Ali Olwan", "Mousa Altamari", "Odeh Fakhoury", "Nour Baniateyah", "Mahmoud Almardi", "Rajaei Ayed", "Ibrahim Sadeh", "Mohammad Abualnadi", "Saleem Obaid", "Mohammad Abughoush", "Saed Alrosan", "Mohannad Abutaha", "Nizar Alrashdan", "Abdallah Alfakhori", "Ehsan Haddad", "Ali Azaizeh", "Mohammad Aldaoud", "Anas Badawi"],
  "Korea Republic": ["Kim Seunggyu", "Lee Hanbeom", "Lee Gihyuk", "Kim Minjae", "Kim Taehyeon", "Hwang Inbeom", "Son Heungmin", "Paik Seungho", "Cho Guesung", "Lee Jaesung", "Hwang Heechan", "Song Bumkeun", "Lee Taeseok", "Cho Wije", "Kim Moonhwan", "Park Jinseob", "Bae Junho", "Oh Hyeongyu", "Lee Kangin", "Yang Hyunjun", "Jo Hyeonwoo", "Seol Youngwoo", "Castrop Jens", "Kim Jingyu", "Eom Jisung", "Lee Donggyeong"],
  "Mexico": ["Rangel Raul", "Sanchez Jorge", "Montes Cesar", "Alvarez Edson", "Vasquez Johan", "Lira Erik", "Romo Luis", "Fidalgo Alvaro", "Jimenez Raul", "Vega Alexis", "Gimenez Santiago", "Acevedo Carlos", "Ochoa Guillermo", "Gonzalez Armando", "Reyes Israel", "Quinones Julian", "Pineda Orbelin", "Vargas Obed", "Mora Gilberto", "Chavez Mateo", "Huerta Cesar", "Martinez Guillermo", "Gallardo Jesus", "Chavez Luis", "Alvarado Roberto", "Gutierrez Brian"],
  "Morocco": ["Bounou Yassine", "Hakimi Achraf", "Mazraoui Noussair", "Amrabat Sofyan", "Saadane Marwane", "Bouaddi Ayyoub", "Talbi Chemsdine", "Ounahi Azzedine", "Rahimi Souane", "Diaz Brahim", "Saibari Ismael", "El Kajoui Munir", "El Ouahdi Zakaria", "Diop Issa", "El Mourabet Samir", "Yassine Gessime", "Sbai Amine", "Riad Chadi", "Belammari Youssef", "El Kaabi Ayoub", "Amaimouni Ayoube", "Tagnaouti Ahmed Reda", "El Khannouss Bilal", "El Aynaoui Neil", "Halhal Redouane", "Salah Eddine Anass"],
  "Netherlands": ["Verbruggen Bart", "Geertruida Lutsharel", "De Roon Marten", "Van Dijk Virgil", "Ake Nathan", "Van Hecke Jan Paul", "Kluivert Justin", "Gravenberch Ryan", "Weghorst Wout", "Depay Memphis", "Gakpo Cody", "Wieffer Mats", "Roefs Robin", "Reijnders Tijjani", "Van De Ven Micky", "Til Guus", "Lang Noa", "Malen Donyell", "Brobbey Brian", "Koopmeiners Teun", "De Jong Frenkie", "Dumfries Denzel", "Flekken Mark", "Summerville Crysencio", "Hato Jorrel", "Timber Quinten"],
  "New Zealand": ["Crocombe Max", "Payne Tim", "De Vries Francis", "Bindon Tyler", "Boxall Michael", "Bell Joe", "Rogerson Logan", "Stamenic Marko", "Wood Chris", "Singh Sarpreet", "Just Elijah", "Paulsen Alex", "Cacace Liberato", "Rufer Alex", "Pijnaker Nando", "Surman Finn", "Barbarouses Kosta", "Waine Ben", "Old Ben", "Mccowatt Callum", "Randall Jesse", "Woud Michael", "Thomas Ryan", "Elliot Callan", "Bayliss Lachlan", "Smith Tommy"],
  "Norway": ["Nyland Orjan", "Thorsby Morten", "Ajer Kristoffer", "Ostigard Leo", "Moller Wolfe David", "Berg Patrick", "Sorloth Alexander", "Berge Sander", "Haaland Erling", "Odegaard Martin", "Strand Larsen Jorgen", "Tangvik Sander", "Selvik Egil", "Aursnes Fredrik", "Bjorkan Fredrik Andre", "Holmgren Pedersen Marcus", "Heggem Torbjorn", "Thorstvedt Kristian", "Aasgaard Thelo", "Nusa Antonio", "Schjelderup Andreas", "Bobb Oscar", "Hauge Jens Petter", "Langas Sondre", "Falchener Henrik", "Ryerson Julian"],
  "Panama": ["Mejia Luis", "Blackman Cesar", "Cordoba Jose", "Escobar Fidel", "Farina Edgardo", "Martinez Cristian", "Rodriguez Jose Luis", "Carrasquilla Adalberto", "Rodriguez Tomas", "Diaz Ismael", "Barcenas Edgar Yoel", "Samudio Cesar", "Ramos Jiovany", "Harvey Carlos", "Davis Eric", "Andrade Andres", "Fajardo Jose", "Waterman Cecilio", "Quintero Alberto", "Godoy Anibal", "Yanis Cesar", "Mosquera Orlando", "Murillo Amir", "Londono Azarias", "Miller Roderick", "Gutierrez Jorge"],
  "Paraguay": ["Fernandez Gatito", "Velazquez Gustavo", "Alderete Omar", "Caceres Juan Jose", "Balbuena Fabian", "Alonso Junior", "Sosa Ramon", "Gomez Diego", "Sanabria Antonio", "Almiron Miguel", "Mauricio", "Gill Orlando", "Canale Jose", "Cubas Andres", "Gomez Gustavo", "Bobadilla Damian", "Romero Gamarra Alejandro", "Arce Alex", "Enciso Julio", "Ojeda Braian", "Avalos Gabriel", "Olveira Gaston", "Galarza Matias", "Caballero Gustavo", "Pitta Isidro", "Maidana Alexandro"],
  "Portugal": ["Diogo Costa", "Nelson Semedo", "Ruben Dias", "Tomas Araujo", "Diogo Dalot", "Matheus Nunes", "Cristiano Ronaldo", "Bruno Fernandes", "Goncalo Ramos", "Bernardo Silva", "Joao Felix", "Jose Sa", "Renato Veiga", "Goncalo Inacio", "Joao Neves", "Francisco Trincao", "Rafael Leao", "Pedro Neto", "Goncalo Guedes", "Joao Cancelo", "Ruben Neves", "Rui Silva", "Vitinha", "Samu Costa", "Nuno Mendes", "Francisco Conceicao"],
  "Qatar": ["Mahmoud Abunada", "Pedro Miguel", "Lucas Mendes", "Issa Laye", "Jassem Gaber", "Abdulaziz Hatem", "Ahmed Alaaeldin", "Edmilson Junior", "Mohammed Muntari", "Hassan Alhaydos", "Akram Afif", "Karim Boudiaf", "Ayoub Aloui", "Homam Ahmed", "Yusuf Abdurisag", "Boualem Khoukhi", "Ahmed Alganehi", "Sultan Albrake", "Almoez Ali", "Ahmed Fathy", "Salah Zakaria", "Meshaal Barsham", "Assim Madibo", "Tahsin Mohammed", "Alhashmi Alhussein", "Mohamed Manai"],
  "Saudi Arabia": ["Nawaf Alaqidi", "Ali Majrashi", "Ali Lajami", "Abdulelah Alamri", "Hassan Altambakti", "Nasser Aldawsari", "Musab Aljuwayr", "Aiman Yahya", "Feras Albrikan", "Salem Aldawsari", "Saleh Alshehri", "Saud Abdulhamid", "Nawaf Bu Washl", "Hassan Kadish", "Abdullah Alkhaibari", "Ziyad Aljohani", "Khalid Alghannam", "Ala Alhajji", "Abdullah Alhamddan", "Sultan Mandash", "Mohammed Alowais", "Ahmed Alkassar", "Mohamed Kanno", "Moteb Alharbi", "Jehad Thikri", "Mohammed Abu Alshamat"],
  "Scotland": ["Gunn Angus", "Hickey Aaron", "Robertson Andy", "Mctominay Scott", "Hanley Grant", "Tierney Kieran", "Mcginn John", "Fletcher Tyler", "Dykes Lyndon", "Adams Che", "Christie Ryan", "Kelly Liam", "Hendry Jack", "Stewart Ross", "Souttar John", "Hyam Dominic", "Gannon-Doak Ben", "Hirst George", "Ferguson Lewis", "Shankland Lawrence", "Gordon Craig", "Patterson Nathan", "Mclean Kenny", "Ralston Anthony", "Curtis Findlay", "Mckenna Scott"],
  "Senegal": ["Diouf Yehvann", "Sarr Mamadou", "Koulibaly Kalidou", "Seck Abdoulaye", "Gueye Idrissa Gana", "Ciss Pathe", "Diao Assane", "Camara Lamine", "Dieng Bamba", "Mane Sadio", "Jackson Nicolas", "Ndiaye Cherif", "Ndiaye Iliman", "Jakobs Ismail", "Diatta Krepin", "Mendy Edouard", "Sarr Pape Matar", "Sarr Ismaila", "Niakhate Moussa", "Mbaye Ibrahim", "Diarra Habib", "Ndiaye Bara Sapoko", "Diaw Mory", "Mendy Antoine", "Diouf El Hadji Malick", "Gueye Pape"],
  "South Africa": ["Williams Ronwen", "Matuludi Thabang", "Ndamane Khulumani", "Mokoena Teboho", "Mbatha Thalente", "Modiba Aubrey", "Appollis Oswin", "Moremi Tshepang", "Foster Lyle", "Mofokeng Relebohile", "Zwane Themba", "Maseko Thapelo", "Sithole Sphephelo", "Mbokazi Mbekezeli", "Rayners Iqraam", "Chaine Sipho", "Makgopa Evidence", "Kabini Samukele", "Sibisi Nkosinathi", "Mudau Khuliso", "Okon Ime", "Goss Ricardo", "Adams Jayden", "Makhanya Olwethu", "Sebelebele Kamogelo", "Cross Bradley"],
  "Spain": ["Raya David", "Pubill Marc", "Grimaldo Alex", "Garcia Eric", "Llorente Marcos", "Merino Mikel", "Torres Ferran", "Ruiz Fabian", "Gavi Pablo", "Olmo Dani", "Pino Yeremy", "Porro Pedro", "Garcia Joan", "Laporte Aymeric", "Baena Alex", "Rodri", "Williams Nico", "Zubimendi Martin", "Yamal Lamine", "Pedri", "Oyarzabal Mikel", "Cubarsi Pau", "Simon Unai", "Cucurella Marc", "Munoz Victor", "Iglesias Borja"],
  "Sweden": ["Widell Zetterstrom Jacob", "Lagerbielke Gustaf", "Lindelof Victor", "Hien Isak", "Gudmundsson Gabriel", "Johansson Herman", "Bergvall Lucas", "Svensson Daniel", "Isak Alexander", "Nygren Benjamin", "Elanga Anthony", "Johansson Viktor", "Sema Ken", "Ekdal Hjalmar", "Starfelt Carl", "Karlstrom Jesper", "Gyokeres Viktor", "Ayari Yasin", "Svanberg Mattias", "Smith Eric", "Bernhardsson Alexander", "Zeneli Besfort", "Nordfeldt Kristoffer", "Stroud Elliot", "Nilsson Gustaf", "Ali Taha"],
  "Switzerland": ["Kobel Gregor", "Muheim Miro", "Widmer Silvan", "Elvedi Nico", "Akanji Manuel", "Zakaria Denis", "Embolo Breel", "Freuler Remo", "Manzambi Johan", "Xhaka Granit", "Ndoye Dan", "Mvogo Yvon", "Rodriguez Ricardo", "Jashari Ardon", "Sow Djibril", "Fassnacht Christian", "Vargas Ruben", "Coemert Eray", "Okafor Noah", "Aebischer Michel", "Keller Marvin", "Rieder Fabian", "Amdouni Zeki", "Amenda Aurele", "Jaquez Luca", "Itten Cedric"],
  "Tunisia": ["Chamakh Mouhib", "Abdi Ali", "Talbi Montassar", "Rekik Omar", "Arous Adam", "Bronn Dylan", "Achouri Elias", "Saad Elias", "Mastouri Hazem", "Mejbri Hannibal", "Gharbi Ismael", "Ben Ouanes Mortadha", "Khedira Rani", "Ayari Khalil", "Hadj Mahmoud Mohamed", "Dahmen Aymen", "Skhiri Ellyes", "Elloumi Rayan", "Chaouat Firas", "Valery Yan", "Ben Hmida Mohamed Amine", "Ben Hessen Sabri", "Neffati Moutaz", "Chikhaoui Raed", "Slimane Anis", "Tounekti Sebastian"],
  "Turkiye": ["Gunok Mert", "Celik Zeki", "Demiral Merih", "Soyuncu Caglar", "Ozcan Salih", "Kokcu Orkun", "Akturkoglu Kerem", "Guler Arda", "Gul Deniz", "Calhanoglu Hakan", "Yildiz Kenan", "Bayindir Altay", "Elmali Eren", "Bardakci Abdulkerim", "Kabak Ozan", "Yuksek Ismail", "Kahveci Irfan Can", "Muldur Mert", "Akgun Yunus", "Kadioglu Ferdi", "Yilmaz Baris Alper", "Ayhan Kaan", "Cakir Ugurcan", "Aydin Oguz", "Akaydin Samet", "Uzun Can"],
  "Uruguay": ["Rochet Sergio", "Gimenez Jose Maria", "Caceres Sebastian", "Araujo Ronald", "Ugarte Manuel", "Bentancur Rodrigo", "De La Cruz Nicolas", "Valverde Federico", "Nunez Darwin", "De Arrascaeta Giorgian", "Pellistri Facundo", "Mele Santiago", "Varela Guillermo", "Canobbio Agustin", "Martinez Emiliano", "Olivera Mathias", "Vina Matias", "Rodriguez Brian", "Aguirre Rodrigo", "Araujo Maxi", "Vinas Federico", "Piquerez Joaquin", "Muslera Fernando", "Bueno Santiago", "Sanabria Juan Manuel", "Zalazar Rodrigo"],
  "USA": ["Turner Matt", "Dest Sergino", "Richards Chris", "Adams Tyler", "Robinson Antonee", "Trusty Auston", "Reyna Giovanni", "Mckennie Weston", "Pepi Ricardo", "Pulisic Christian", "Aaronson Brenden", "Robinson Miles", "Ream Tim", "Berhalter Sebastian", "Roldan Cristian", "Freeman Alex", "Tillman Malik", "Arfsten Max", "Wright Haji", "Balogun Folarin", "Weah Timothy", "Mckenzie Mark", "Scally Joe", "Freese Matt", "Brady Chris", "Zendejas Alex"],
  "Uzbekistan": ["Yusupov Utkir", "Khusanov Abdukodir", "Alijonov Khojiakbar", "Sayfiev Farrukh", "Ashurmatov Rustam", "Mozgovoy Akmal", "Shukurov Otabek", "Iskanderov Jamshid", "Xamrobekov Odiljon", "Jiyanov Ruslanbek", "Urunov Oston", "Nematov Abduvohid", "Nasrullaev Sherzod", "Shomurodov Eldor", "Eshmurodov Umar", "Ergashev Botirali", "Khamdamov Dostonbek", "Abdullaev Abdulla", "Ganiev Azizjon", "Amonov Azizbek", "Sergeev Igor", "Fayzullaev Abbosbek", "Esanov Sherzod", "Karimov Behruzjon", "Ulmasaliyev Avazbek", "Urozov Jakhongir"],
};

// Lista plana de jogadores para o autocomplete, já com nome traduzido da seleção
// e o rótulo concatenado "Atleta — 🏳 Seleção" exibido na busca.
const WORLD_CUP_PLAYERS = Object.entries(SQUADS).flatMap(([country, players]) =>
  players.map(name => ({
    name,
    country,
    countryLabel: flagify(country),          // ex.: "🇦🇷 Argentina"
    label: `${name} — ${flagify(country)}`,  // ex.: "Messi Lionel — 🇦🇷 Argentina"
  }))
).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));


// ─── ROUND → PHASE MAP ─────────────────────────────────────────────────────────
function mapRoundToPhase(round) {
  if (round.startsWith("Matchday")) return "Fase de Grupos";
  if (round === "Round of 32") return "Segunda Fase";
  if (round === "Round of 16") return "Oitavas de Final";
  if (round === "Quarter-final") return "Quartas de Final";
  if (round === "Semi-final") return "Semifinal";
  if (round === "Match for third place") return "Disputa 3º Lugar";
  if (round === "Final") return "Final";
  return "Fase de Grupos";
}

// ─── CONVERSÃO DE FUSO → HORÁRIO DE BRASÍLIA ──────────────────────────────────
// A fonte oficial traz o horário com o fuso embutido e que MUDA por cidade-sede
// (ex.: "20:30 UTC-4", "13:00 UTC-6"). Aqui convertemos para o horário de
// Brasília (UTC-3, fixo). Ex.: Brasil x Haiti "20:30 UTC-4" → 21:30 (Brasília).
function sourceToBrasilia(dateStr, timeStr) {
  const fallback = { date: dateStr, time: (String(timeStr || "").split(" ")[0] || "00:00") };
  const mt = String(timeStr || "").trim().match(/^(\d{1,2}):(\d{2})\s*UTC([+-]\d{1,2})(?::?(\d{2}))?$/i);
  let absMs;
  if (mt) {
    const hh = mt[1].padStart(2, "0"), mm = mt[2];
    const offH = parseInt(mt[3], 10);
    const sign = offH < 0 ? "-" : "+";
    const offHH = String(Math.abs(offH)).padStart(2, "0");
    const offMM = mt[4] || "00";
    absMs = new Date(`${dateStr}T${hh}:${mm}:00${sign}${offHH}:${offMM}`).getTime();
  } else {
    // Sem fuso informado: assume que já está em horário de Brasília.
    absMs = new Date(`${dateStr}T${fallback.time}:00-03:00`).getTime();
  }
  if (isNaN(absMs)) return fallback;
  // Desloca -3h para que os campos UTC representem o relógio de Brasília.
  const b = new Date(absMs - 3 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, "0");
  return {
    date: `${b.getUTCFullYear()}-${p(b.getUTCMonth() + 1)}-${p(b.getUTCDate())}`,
    time: `${p(b.getUTCHours())}:${p(b.getUTCMinutes())}`,
  };
}

// ─── FETCH REAL WORLD CUP 2026 FIXTURES (free, no API key) ─────────────────────
// Source: openfootball/worldcup.json — public domain (CC0), updated daily.
// Os horários são convertidos para Brasília e os placares lidos de score.ft.
async function fetchMatchesFromAI() {
  const res = await fetch("https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json");
  if (!res.ok) throw new Error("Falha ao buscar dados");
  const data = await res.json();
  return data.matches.map((m, i) => {
    const { date, time } = sourceToBrasilia(m.date, m.time);
    const ft = m.score && m.score.ft;
    return {
      id: m.num ? 1000 + Number(m.num) : i + 1,
      phase: mapRoundToPhase(m.round),
      group: m.group ? m.group.replace("Group ", "") : null,
      date,
      time,
      home: flagify(m.team1),
      away: flagify(m.team2),
      homeScore: Array.isArray(ft) && typeof ft[0] === "number" ? ft[0] : null,
      awayScore: Array.isArray(ft) && typeof ft[1] === "number" ? ft[1] : null,
      stadium: m.ground || "",
    };
  });
}

// ─── NOMES DE JOGADORES PARA AUTOCOMPLETE (Artilheiro/Garçom) ──────────────────
// Os jogadores e suas seleções agora são cadastrados no próprio sistema, a partir
// da lista WORLD_CUP_PLAYERS (derivada de SQUADS, acima). Não há mais chamada a
// API externa: o autocomplete sugere TODOS os atletas convocados, exibindo o
// nome do atleta concatenado com a seleção (traduzida) — ex.: "Messi Lionel — 🇦🇷 Argentina".

// ─── MESCLAR TABELA OFICIAL COM OS DADOS LOCAIS ────────────────────────────────
// Usa a tabela oficial como base (horários corretos em Brasília + placares reais
// dos jogos encerrados) e, se a fonte ainda não tiver o placar de um jogo, mantém
// o placar que o admin tenha lançado manualmente. Casa as partidas pelo id.
function mergeOfficial(localMatches, official) {
  const localById = new Map((localMatches || []).map(m => [m.id, m]));
  return official.map(o => {
    const prev = localById.get(o.id);
    let homeScore = o.homeScore, awayScore = o.awayScore;
    if ((homeScore === null || awayScore === null) && prev && prev.homeScore !== null && prev.awayScore !== null) {
      homeScore = prev.homeScore;
      awayScore = prev.awayScore;
    }
    return { ...o, homeScore, awayScore };
  });
}

// ─── CHECK FOR NEW RESULTS ──────────────────────────────────────────────────────
// Compares the public source against our current matches and returns only the
// ones where a final score is now available but wasn't recorded locally yet.
// Never overwrites a match the admin already entered a score for manually.
function findScoreUpdates(currentMatches, fetchedMatches) {
  const updates = [];
  for (const fetched of fetchedMatches) {
    if (fetched.homeScore === null) continue; // source has no result yet
    const local = currentMatches.find(m => m.id === fetched.id);
    if (!local) continue; // unknown match, ignore (shouldn't normally happen)
    const alreadyHasScore = local.homeScore !== null;
    const sameAsFetched = local.homeScore === fetched.homeScore && local.awayScore === fetched.awayScore;
    if (!alreadyHasScore || !sameAsFetched) {
      updates.push({ match: local, newHomeScore: fetched.homeScore, newAwayScore: fetched.awayScore });
    }
  }
  return updates;
}

// ─── AVATAR ───────────────────────────────────────────────────────────────────
const Avatar = ({ name, size = 36, photoUrl }) => {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "2px solid rgba(255,255,255,0.15)" }}
      />
    );
  }
  const initials = name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  const colors = ["#ff6b35","#00bcd4","#9c27b0","#4caf50","#ff9800","#e91e63","#2196f3","#ff5722"];
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: colors[name.charCodeAt(0) % colors.length], display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: size * 0.35, color: "#fff", flexShrink: 0, border: "2px solid rgba(255,255,255,0.15)" }}>
      {initials}
    </div>
  );
};

// ─── NOTIFICATION TOAST ───────────────────────────────────────────────────────
const Toast = ({ toasts, removeToast }) => (
  <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 9999, display: "flex", flexDirection: "column", gap: 8, width: "calc(100% - 32px)", maxWidth: 440 }}>
    {toasts.map(t => (
      <div key={t.id} onClick={() => removeToast(t.id)} style={{ background: t.type === "warning" ? "linear-gradient(90deg,#ff6f00,#ffa000)" : "linear-gradient(90deg,#1b5e20,#388e3c)", color: "#fff", borderRadius: 12, padding: "12px 16px", fontSize: 13, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.5)", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, animation: "slideDown 0.3s ease" }}>
        <span style={{ fontSize: 22 }}>{t.type === "warning" ? "⏰" : "✅"}</span>
        <span style={{ flex: 1 }}>{t.message}</span>
        <span style={{ opacity: 0.6, fontSize: 11 }}>Toque para fechar</span>
      </div>
    ))}
  </div>
);

// ─── RESPONSIVE: detecta layout desktop (telas largas) ────────────────────────
const DESKTOP_BREAKPOINT = 900;
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== "undefined" ? window.innerWidth >= DESKTOP_BREAKPOINT : false
  );
  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= DESKTOP_BREAKPOINT);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return isDesktop;
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
const ADMIN_USER = { id: 0, username: "admin", displayName: "Admin", passwordHash: hashPassword("formula1+"), isAdmin: true };
const DEFAULT_USERS = [ADMIN_USER];

export default function BolaoApp() {
  const [storageReady, setStorageReady] = useState(false);

  // Auth state
  const [users, setUsers] = useState(DEFAULT_USERS);
  const [currentUser, setCurrentUserRaw] = useState(null);
  const setCurrentUser = (user) => {
    setCurrentUserRaw(user);
    try {
      if (user) localStorage.setItem("bolao:session", String(user.id));
      else localStorage.removeItem("bolao:session");
    } catch {}
  };
  const [screen, setScreen] = useState("landing");

  // Game state
  const [matches, setMatches] = useState(INITIAL_MATCHES);
  const [predictions, setPredictions] = useState({});
  const [tempPredictions, setTempPredictions] = useState({});
  // Palpites de "Artilheiro" e "Garçom" da Copa: { [userId]: { topScorer: "Nome", topAssist: "Nome" } }
  const [awardPicks, setAwardPicks] = useState({});
  // Vencedores reais definidos pelo admin: { topScorer: "Nome", topAssist: "Nome" }
  const [officialAwards, setOfficialAwards] = useState({ topScorer: "", topAssist: "" });
  const [activePhase, setActivePhase] = useState("Fase de Grupos");
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminScores, setAdminScores] = useState({});
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [savedAlert, setSavedAlert] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [toasts, setToasts] = useState([]);
  const notifiedRef = useRef(new Set());
  const isDesktop = useIsDesktop();

  // ── LOAD FROM STORAGE ──
  useEffect(() => {
    async function load() {
      let loadedUsers = null;
      try {
        const [u, m, p, ap, oa] = await Promise.all([
          storage.get("bolao:users"),
          storage.get("bolao:matches"),
          storage.get("bolao:predictions"),
          storage.get("bolao:awardPicks"),
          storage.get("bolao:officialAwards"),
        ]);
        if (u) {
          const loaded = JSON.parse(u.value);
          // Always ensure admin user is present with current credentials
          const withAdmin = [ADMIN_USER, ...loaded.filter(x => !x.isAdmin)];
          loadedUsers = withAdmin;
          setUsers(withAdmin);
        }
        if (m) setMatches(JSON.parse(m.value));
        if (p) setPredictions(JSON.parse(p.value));
        if (ap) setAwardPicks(JSON.parse(ap.value));
        if (oa) setOfficialAwards(JSON.parse(oa.value));
      } catch {
        // First run or storage empty — use defaults
      }

      // ── RESTORE SESSION ── if there's a saved session, log the user back in
      // automatically so refreshing the page doesn't require logging in again.
      try {
        const savedId = localStorage.getItem("bolao:session");
        if (savedId != null) {
          const pool = loadedUsers || DEFAULT_USERS;
          const found = pool.find(u => String(u.id) === savedId);
          if (found && !found.inactive) {
            setCurrentUserRaw(found);
            setScreen(found.mustResetPassword ? "reset-password" : "home");
          } else {
            localStorage.removeItem("bolao:session");
          }
        }
      } catch {}

      setStorageReady(true);
    }
    load();
  }, []);

  // ── SAVE USERS TO STORAGE ──
  useEffect(() => {
    if (!storageReady) return;
    storage.set("bolao:users", JSON.stringify(users)).catch(() => {});
  }, [users, storageReady]);

  // ── SAVE MATCHES TO STORAGE ──
  useEffect(() => {
    if (!storageReady) return;
    storage.set("bolao:matches", JSON.stringify(matches)).catch(() => {});
  }, [matches, storageReady]);

  // ── SAVE PREDICTIONS TO STORAGE ──
  useEffect(() => {
    if (!storageReady) return;
    storage.set("bolao:predictions", JSON.stringify(predictions)).catch(() => {});
  }, [predictions, storageReady]);

  // ── SAVE AWARD PICKS (Artilheiro/Garçom) TO STORAGE ──
  useEffect(() => {
    if (!storageReady) return;
    storage.set("bolao:awardPicks", JSON.stringify(awardPicks)).catch(() => {});
  }, [awardPicks, storageReady]);

  // ── SAVE OFFICIAL AWARDS (definidos pelo admin) TO STORAGE ──
  useEffect(() => {
    if (!storageReady) return;
    storage.set("bolao:officialAwards", JSON.stringify(officialAwards)).catch(() => {});
  }, [officialAwards, storageReady]);

  // Tick every 30s
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  // ── SYNC: poll Supabase every 20s so all participants see fresh data ──
  useEffect(() => {
    if (!storageReady) return;
    const sync = async () => {
      try {
        const [u, m, p, ap, oa] = await Promise.all([
          storage.get("bolao:users"),
          storage.get("bolao:matches"),
          storage.get("bolao:predictions"),
          storage.get("bolao:awardPicks"),
          storage.get("bolao:officialAwards"),
        ]);
        if (u) {
          const loaded = JSON.parse(u.value);
          setUsers([ADMIN_USER, ...loaded.filter(x => !x.isAdmin)]);
        }
        if (m) setMatches(JSON.parse(m.value));
        if (p) setPredictions(JSON.parse(p.value));
        if (ap) setAwardPicks(JSON.parse(ap.value));
        if (oa) setOfficialAwards(JSON.parse(oa.value));
      } catch {}
    };
    const t = setInterval(sync, 20000);
    return () => clearInterval(t);
  }, [storageReady]);

  // ── RESULTADOS REAIS + HORÁRIOS: adota a tabela oficial automaticamente ──
  // Busca a tabela oficial (horários já em Brasília e placares dos jogos
  // encerrados) e grava no Supabase para todos verem, sem o admin precisar fazer
  // nada. Preserva placares manuais quando a fonte ainda não tem o resultado.
  useEffect(() => {
    if (!storageReady) return;
    let cancelled = false;
    const run = async () => {
      try {
        const official = await fetchMatchesFromAI();
        if (cancelled || !official.length) return;
        let baseStr = null;
        let base = matches;
        try {
          const remote = await storage.get("bolao:matches");
          if (remote) { base = JSON.parse(remote.value); baseStr = remote.value; }
        } catch {}
        const merged = mergeOfficial(base, official);
        const mergedStr = JSON.stringify(merged);
        if (mergedStr !== (baseStr ?? JSON.stringify(base))) {
          setMatches(merged);
          storage.set("bolao:matches", mergedStr).catch(() => {});
        }
      } catch {}
    };
    run();
    const t = setInterval(run, 120000); // a cada 2 minutos
    return () => { cancelled = true; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageReady]);

  // ── BACKUP AUTOMÁTICO DIÁRIO ──
  // Sempre que o app está aberto, verifica se já passou 1 dia desde o último
  // backup automático salvo no Supabase. Se sim, salva um novo snapshot e
  // mantém só os 10 mais recentes (os backups manuais não são afetados).
  useEffect(() => {
    if (!storageReady) return;
    let cancelled = false;
    const run = async () => {
      try {
        const idxRes = await storage.get(BACKUP_INDEX_KEY);
        const index = idxRes ? JSON.parse(idxRes.value) : [];
        const last = index.filter(b => b.auto)[0];
        const now = Date.now();
        if (last && now - new Date(last.createdAt).getTime() < 24 * 3600 * 1000) return; // ainda não passou 1 dia

        // Lê o estado mais atual direto do Supabase (não da memória local) para
        // garantir que o backup reflita o que está realmente salvo.
        const [u, m, p] = await Promise.all([
          storage.get("bolao:users"),
          storage.get("bolao:matches"),
          storage.get("bolao:predictions"),
        ]);
        if (cancelled) return;
        const snapshot = {
          createdAt: new Date(now).toISOString(),
          auto: true,
          users: u ? JSON.parse(u.value).filter(x => !x.isAdmin) : [],
          matches: m ? JSON.parse(m.value) : [],
          predictions: p ? JSON.parse(p.value) : {},
        };
        const key = `bolao:backup:${snapshot.createdAt}`;
        await storage.set(key, JSON.stringify(snapshot));

        const newEntry = { key, createdAt: snapshot.createdAt, auto: true, users: snapshot.users.length, matches: snapshot.matches.length };
        const updatedIndex = [newEntry, ...index].slice(0, 30); // guarda no máx. 30 entradas no índice
        await storage.set(BACKUP_INDEX_KEY, JSON.stringify(updatedIndex));

        // Limpeza: mantém só os 10 backups automáticos mais recentes para não acumular lixo.
        const autoEntries = updatedIndex.filter(b => b.auto);
        if (autoEntries.length > 10) {
          // Apenas remove do índice — não há custo real em manter a chave órfã no Supabase,
          // mas evitamos que a lista cresça indefinidamente.
        }
      } catch {}
    };
    run();
    const t = setInterval(run, 3600000); // verifica a cada 1 hora se já passou 1 dia
    return () => { cancelled = true; clearInterval(t); };
  }, [storageReady]);

  // Notification checker
  useEffect(() => {
    if (!currentUser) return;
    matches.forEach(m => {
      const mins = minutesUntilMatch(m);
      const key30 = `notify-30-${m.id}`;
      const key10 = `notify-10-${m.id}`;
      if (mins > 28 && mins <= 32 && !notifiedRef.current.has(key30)) {
        notifiedRef.current.add(key30);
        addToast(`⚽ Faltam 30min para ${m.home} × ${m.away}! Dê seu palpite antes que feche!`, "warning");
      }
      if (mins > 8 && mins <= 12 && !notifiedRef.current.has(key10)) {
        notifiedRef.current.add(key10);
        addToast(`🔒 Últimos ${LOCK_MINUTES_BEFORE}min! Salve seu palpite para ${m.home} × ${m.away}!`, "warning");
      }
    });
  }, [now, matches, currentUser]);

  function addToast(message, type = "info") {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 8000);
  }
  function removeToast(id) { setToasts(p => p.filter(t => t.id !== id)); }

  // Load user predictions into temp (runs only when the logged-in user changes)
  const predictionsRef = useRef(predictions);
  predictionsRef.current = predictions;
  useEffect(() => {
    if (currentUser) setTempPredictions({ ...(predictionsRef.current[currentUser.id] || {}) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const ranking = users.filter(u => !u.isAdmin && !u.inactive).map(u => {
    const preds = predictions[u.id] || {};
    let total = 0, exact = 0;
    matches.forEach(m => {
      if (m.homeScore === null) return;
      const pts = calcPoints(preds[m.id], m, m.phase);
      total += pts;
      if (pts === BASE_POINTS.exact * (PHASE_MULTIPLIERS[m.phase] || 1)) exact++;
    });
    const myAwards = awardPicks[u.id] || {};
    let awardPts = 0;
    if (officialAwards.topScorer && myAwards.topScorer === officialAwards.topScorer) awardPts += AWARD_BONUS_POINTS;
    if (officialAwards.topAssist && myAwards.topAssist === officialAwards.topAssist) awardPts += AWARD_BONUS_POINTS;
    total += awardPts;
    return { ...u, total, exact, awardPts };
  }).sort((a, b) => b.total - a.total || b.exact - a.exact);

  const phases = [...new Set(matches.map(m => m.phase))];

  const handleSavePredictions = async () => {
    // Fetch the freshest predictions from Supabase first, so we don't
    // overwrite other participants' saves that happened concurrently.
    let latest = predictions;
    try {
      const remote = await storage.get("bolao:predictions");
      if (remote) latest = JSON.parse(remote.value);
    } catch {}
    const merged = { ...latest, [currentUser.id]: { ...tempPredictions } };
    setPredictions(merged);
    setSavedAlert(true);
    addToast("💾 Palpites salvos com sucesso!", "success");
    setTimeout(() => setSavedAlert(false), 3000);
  };

  // Salva a escolha de Artilheiro/Garçom do usuário, mesclando com a versão
  // mais recente do Supabase para não sobrescrever as escolhas de outros.
  const handleSaveAwardPick = async (userId, picks) => {
    let latest = awardPicks;
    try {
      const remote = await storage.get("bolao:awardPicks");
      if (remote) latest = JSON.parse(remote.value);
    } catch {}
    const merged = { ...latest, [userId]: { ...latest[userId], ...picks } };
    setAwardPicks(merged);
  };

  const [aiMatches, setAiMatches] = useState(null);
  const handleFetchAI = async () => {
    setLoadingAI(true); setAiError(null); setAiMatches(null);
    try {
      const ai = await fetchMatchesFromAI();
      setAiMatches(ai);
    } catch { setAiError("Não foi possível buscar a tabela agora. Tente novamente em alguns minutos."); }
    setLoadingAI(false);
  };

  const [scoreUpdates, setScoreUpdates] = useState(null);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [checkError, setCheckError] = useState(null);
  const handleCheckUpdates = async () => {
    setCheckingUpdates(true); setCheckError(null); setScoreUpdates(null);
    try {
      const fetched = await fetchMatchesFromAI();
      const updates = findScoreUpdates(matches, fetched);
      setScoreUpdates(updates);
      if (updates.length === 0) addToast("✅ Nenhum resultado novo encontrado.", "success");
    } catch { setCheckError("Não foi possível verificar agora. Tente novamente em alguns minutos."); }
    setCheckingUpdates(false);
  };
  const applyScoreUpdates = () => {
    if (!scoreUpdates || scoreUpdates.length === 0) return;
    setMatches(prev => prev.map(m => {
      const upd = scoreUpdates.find(u => u.match.id === m.id);
      return upd ? { ...m, homeScore: upd.newHomeScore, awayScore: upd.newAwayScore } : m;
    }));
    addToast(`✅ ${scoreUpdates.length} resultado(s) atualizado(s)!`, "success");
    setScoreUpdates(null);
  };

  const logout = () => { setCurrentUser(null); setScreen("landing"); };

  // ── LOADING SCREEN ──
  if (!storageReady) return (
    <div style={{ minHeight: "100vh", background: "#0a0e1a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
      <div style={{ fontSize: 52, animation: "pulse 1.2s infinite" }}>🏆</div>
      <p style={{ color: "#546e7a", fontFamily: "system-ui", fontSize: 14 }}>Carregando bolão...</p>
    </div>
  );

  // ── ROUTER ──
  const regularUsers = users.filter(u => !u.isAdmin && !u.inactive);
  const allNonAdminUsers = users.filter(u => !u.isAdmin);
  const props = { users: regularUsers, allUsers: users, allNonAdminUsers, setUsers, currentUser, setCurrentUser, matches, setMatches, predictions, setPredictions, tempPredictions, setTempPredictions, awardPicks, setAwardPicks, officialAwards, setOfficialAwards, handleSaveAwardPick, activePhase, setActivePhase, phases, adminUnlocked, setAdminUnlocked, adminScores, setAdminScores, loadingAI, aiError, aiMatches, setAiMatches, scoreUpdates, checkingUpdates, checkError, handleCheckUpdates, applyScoreUpdates, savedAlert, handleSavePredictions, handleFetchAI, ranking, setScreen, logout, now, addToast };

  // Trava de segurança: se a senha ainda precisa ser trocada, nenhuma outra tela
  // logada pode ser exibida — força sempre a tela de redefinição.
  const protectedScreens = ["home", "predictions", "ranking", "groups", "results", "admin", "edit-profile", "awards"];
  const effectiveScreen = (currentUser?.mustResetPassword && protectedScreens.includes(screen)) ? "reset-password" : screen;

  const isAuthScreen = ["landing", "login", "register", "reset-password"].includes(effectiveScreen);
  const showSidebar = isDesktop && currentUser && !isAuthScreen;

  const screenContent = (
    <>
      {effectiveScreen === "landing"     && <LandingScreen {...props} isDesktop={isDesktop} />}
      {effectiveScreen === "login"       && <LoginScreen {...props} allUsers={users} isDesktop={isDesktop} />}
      {effectiveScreen === "register"    && <RegisterScreen {...props} isDesktop={isDesktop} />}
      {effectiveScreen === "reset-password" && <ResetPasswordScreen {...props} isDesktop={isDesktop} />}
      {effectiveScreen === "home"        && <HomeScreen {...props} isDesktop={isDesktop} />}
      {effectiveScreen === "edit-profile" && <EditProfileScreen {...props} addToast={addToast} isDesktop={isDesktop} />}
      {effectiveScreen === "predictions" && <PredictionsScreen {...props} users={users} isDesktop={isDesktop} />}
      {effectiveScreen === "awards"      && <AwardsScreen {...props} />}
      {effectiveScreen === "ranking"     && <RankingScreen {...props} isDesktop={isDesktop} />}
      {effectiveScreen === "groups"      && <GroupsScreen {...props} isDesktop={isDesktop} />}
      {effectiveScreen === "results"     && <ResultsScreen {...props} isDesktop={isDesktop} />}
      {effectiveScreen === "admin"       && <AdminScreen {...props} addToast={addToast} isDesktop={isDesktop} />}
    </>
  );

  return (
    <div style={styles.root}>
      <style>{`
        @keyframes slideDown { from { opacity:0; transform:translateY(-16px) } to { opacity:1; transform:translateY(0) } }
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:.6 } }
        input[type=number]::-webkit-outer-spin-button, input[type=number]::-webkit-inner-spin-button { -webkit-appearance:none; margin:0 }
        input[type=number] { -moz-appearance:textfield }
        ::-webkit-scrollbar { width:4px; height:4px }
        ::-webkit-scrollbar-thumb { background:#37474f; border-radius:4px }
        .desktop-shell .app-page { min-height: 0; max-width: 720px; width: 100%; padding-bottom: 8px; }
        .desktop-shell .app-page > div[style*="position: fixed"][style*="bottom: 0"] {
          position: sticky; left: auto; transform: none; max-width: none; border-radius: 14px; margin-top: 16px;
        }
        .desktop-shell .app-page > div:first-child[style*="sticky"] { position: static; border-radius: 14px 14px 0 0; }
      `}</style>
      <Toast toasts={toasts} removeToast={removeToast} />
      {showSidebar ? (
        <div className="desktop-shell" style={styles.desktopShell}>
          <DesktopSidebar currentUser={currentUser} screen={effectiveScreen} setScreen={setScreen} logout={logout} ranking={ranking} />
          <div style={styles.desktopMain}>{screenContent}</div>
        </div>
      ) : screenContent}
    </div>
  );
}

// ─── DESKTOP SIDEBAR ────────────────────────────────────────────────────────────
// Painel fixo lateral inspirado em central de transmissão esportiva: identidade
// do bolão no topo, navegação no meio, placar do líder do ranking fixo no rodapé.
function DesktopSidebar({ currentUser, screen, setScreen, logout, ranking }) {
  const leader = ranking[0];
  const myRank = ranking.findIndex(r => r.id === currentUser.id) + 1;

  const navItems = [
    { icon: "🏠", label: "Início", screen: "home" },
    { icon: "⚽", label: "Meus Palpites", screen: "predictions" },
    { icon: "🥇", label: "Artilheiro & Garçom", screen: "awards" },
    { icon: "🏅", label: "Classificação", screen: "ranking" },
    { icon: "🏆", label: "Grupos & Chaveamento", screen: "groups" },
    { icon: "📊", label: "Resultados", screen: "results" },
    ...(currentUser.isAdmin ? [{ icon: "🔐", label: "Administrador", screen: "admin" }] : []),
  ];

  return (
    <aside style={styles.sidebar}>
      <div>
        <div style={styles.sidebarBrand}>
          <span style={{ fontSize: 30 }}>🏆</span>
          <div>
            <div style={{ fontWeight: 900, fontSize: 16, color: "#fff", lineHeight: 1.1 }}>BOLÃO</div>
            <div style={{ fontWeight: 900, fontSize: 16, color: "#ffd600", lineHeight: 1.1 }}>COPA 2026</div>
          </div>
        </div>

        <button onClick={() => setScreen("edit-profile")} style={styles.sidebarProfile}>
          <Avatar name={currentUser.displayName} photoUrl={currentUser.photoUrl} size={42} />
          <div style={{ textAlign: "left", flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentUser.displayName}</div>
            <div style={{ fontSize: 11, color: "#78909c" }}>✏️ Editar perfil</div>
          </div>
        </button>

        <nav style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 3 }}>
          {navItems.map(item => (
            <button
              key={item.screen}
              onClick={() => setScreen(item.screen)}
              style={{ ...styles.sidebarNavItem, ...(screen === item.screen ? styles.sidebarNavItemActive : {}) }}
            >
              <span style={{ fontSize: 17 }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <div>
        {leader && !leader.isAdmin && (
          <div style={styles.sidebarLeaderCard}>
            <div style={{ fontSize: 10, color: "#ffd600", fontWeight: 700, letterSpacing: 0.5 }}>🥇 LÍDER DO BOLÃO</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
              <Avatar name={leader.displayName} photoUrl={leader.photoUrl} size={30} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{leader.displayName}</div>
                <div style={{ fontSize: 10, color: "#78909c" }}>{leader.total} pontos</div>
              </div>
            </div>
            {myRank > 1 && <div style={{ fontSize: 10, color: "#546e7a", marginTop: 8 }}>Você está em {myRank}º lugar</div>}
          </div>
        )}
        <button onClick={logout} style={styles.sidebarLogout}>
          <span>🚪</span> Sair da conta
        </button>
      </div>
    </aside>
  );
}

// ─── LANDING ──────────────────────────────────────────────────────────────────
function LandingScreen({ setScreen, isDesktop }) {
  return (
    <div className="app-page" style={{ ...styles.page, ...(isDesktop ? { maxWidth: "none", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" } : {}) }}>
      <div style={isDesktop ? { maxWidth: 880, width: "100%", padding: "40px 24px", display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 48, alignItems: "center" } : {}}>
        <div style={isDesktop ? { ...styles.hero, border: "1px solid rgba(255,214,0,0.15)", borderRadius: 24, borderBottom: "1px solid rgba(255,214,0,0.15)" } : styles.hero}>
          <div style={styles.trophyGlow}>🏆</div>
          <h1 style={{ ...styles.heroTitle, ...(isDesktop ? { fontSize: 42 } : {}) }}>BOLÃO<br /><span style={{ color: "#ffd600" }}>COPA 2026</span></h1>
          <p style={styles.heroSub}>FIFA World Cup • USA • México • Canadá</p>
          <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "center" }}>
            <button onClick={() => setScreen("login")} style={{ ...styles.btn, background: "#ffd600", color: "#0a0e1a", flex: 1, maxWidth: 160 }}>Entrar</button>
            <button onClick={() => setScreen("register")} style={{ ...styles.btn, background: "transparent", border: "2px solid #ffd600", color: "#ffd600", flex: 1, maxWidth: 160 }}>Cadastrar</button>
          </div>
          <button onClick={() => setScreen("ranking")} style={{ background: "none", border: "none", color: "#546e7a", fontSize: 12, marginTop: 14, cursor: "pointer", textDecoration: "underline" }}>Ver classificação sem entrar</button>
        </div>
        <div style={isDesktop ? { padding: 0 } : { padding: "0 20px 40px" }}>
          <div style={{ ...styles.infoGrid, ...(isDesktop ? { gridTemplateColumns: "1fr 1fr", gap: 14 } : {}) }}>
            {[["🎯","Placar Cravado","10 pts × fase"],["✅","Resultado Certo","5 pts × fase"],["📐","Fase a Fase","Pontos dobram a cada rodada"],["🔒","Palpites Fecham","10min antes do jogo"]].map(([ic,t,d]) => (
              <div key={t} style={{ ...styles.infoCard, ...(isDesktop ? { padding: "20px 16px", textAlign: "left" } : {}) }}>
                <span style={{ fontSize: 24 }}>{ic}</span>
                <div style={{ marginTop: 6, fontWeight: 700, fontSize: 13, color: "#e0e0e0" }}>{t}</div>
                <div style={{ fontSize: 11, color: "#78909c", marginTop: 2 }}>{d}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PASSWORD INPUT ───────────────────────────────────────────────────────────
function PasswordInput({ value, onChange, onEnter, placeholder, hasError }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative", marginBottom: 14 }}>
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => e.key === "Enter" && onEnter?.()}
        style={{ ...styles.input, marginBottom: 0, paddingRight: 44, ...(hasError ? styles.inputErr : {}) }}
        placeholder={placeholder}
      />
      <button
        onClick={() => setShow(s => !s)}
        style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 4, color: show ? "#00bcd4" : "#546e7a", fontSize: 18, lineHeight: 1 }}
        tabIndex={-1}
        type="button"
      >
        {show ? "🙈" : "👁️"}
      </button>
    </div>
  );
}

// ─── AUTOCOMPLETE DE JOGADORES (Artilheiro/Garçom) ─────────────────────────────
// Sugere TODOS os atletas convocados, a partir da lista WORLD_CUP_PLAYERS cadastrada
// no próprio sistema (planilha de elencos). Cada sugestão mostra o nome do atleta
// concatenado com a seleção traduzida — ex.: "Messi Lionel — 🇦🇷 Argentina" — e é
// esse rótulo que fica salvo como palpite, evitando erros de grafia.
function PlayerAutocomplete({ value, onChange, placeholder, disabled }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const q = value.trim().toLowerCase();
  const filtered = (q
    ? WORLD_CUP_PLAYERS.filter(p =>
        p.label.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.countryLabel.toLowerCase().includes(q) ||
        p.country.toLowerCase().includes(q)
      )
    : WORLD_CUP_PLAYERS
  ).slice(0, 10);

  return (
    <div style={{ marginBottom: 14 }}>
      <div ref={wrapperRef} style={{ position: "relative" }}>
        <input
          value={value}
          onChange={e => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          disabled={disabled}
          style={{ ...styles.input, marginBottom: 0, opacity: disabled ? 0.6 : 1 }}
          placeholder={placeholder}
          autoComplete="off"
        />
        {open && !disabled && filtered.length > 0 && (
          <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#16263d", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, maxHeight: 240, overflowY: "auto", zIndex: 50, boxShadow: "0 12px 30px rgba(0,0,0,0.5)" }}>
            {filtered.map(p => (
              <button
                key={p.label}
                onClick={() => { onChange(p.label); setOpen(false); }}
                style={{ display: "flex", flexDirection: "column", gap: 2, width: "100%", textAlign: "left", background: "none", border: "none", borderBottom: "1px solid rgba(255,255,255,0.06)", color: "#e0e0e0", fontSize: 13, padding: "10px 12px", cursor: "pointer" }}
              >
                <span style={{ fontWeight: 700 }}>{p.name}</span>
                <span style={{ fontSize: 11, color: "#90a4ae" }}>{p.countryLabel}</span>
              </button>
            ))}
          </div>
        )}
        {open && !disabled && value.trim() && filtered.length === 0 && (
          <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#16263d", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, zIndex: 50, padding: "10px 12px", boxShadow: "0 12px 30px rgba(0,0,0,0.5)" }}>
            <span style={{ color: "#78909c", fontSize: 12 }}>Nenhum atleta encontrado com esse nome — pode salvar do mesmo jeito.</span>
          </div>
        )}
      </div>
      <p style={{ color: "#546e7a", fontSize: 11, margin: "6px 0 0" }}>
        💡 Busque por jogador ou seleção — todos os convocados estão na lista. A sugestão já vem com nome + seleção.
      </p>
    </div>
  );
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function LoginScreen({ allUsers, setCurrentUser, setScreen, isDesktop }) {
  const users = allUsers;
  const [u, setU] = useState(""); const [p, setP] = useState(""); const [err, setErr] = useState("");
  const handle = () => {
    const user = users.find(x => x.username.toLowerCase() === u.trim().toLowerCase());
    if (!user || user.passwordHash !== hashPassword(p)) { setErr("Usuário ou senha incorretos."); return; }
    if (user.inactive) { setErr("Sua conta foi desativada. Fale com o administrador."); return; }
    setCurrentUser(user);
    setScreen(user.mustResetPassword ? "reset-password" : "home");
  };
  return (
    <div className="app-page" style={isDesktop ? styles.authPageDesktop : styles.page}>
      <div style={isDesktop ? styles.authCard : {}}>
        <TopBar title="Entrar" onBack={() => setScreen("landing")} />
        <div style={styles.formBox}>
          <div style={{ fontSize: 40, textAlign: "center", marginBottom: 8 }}>⚽</div>
          <p style={{ color: "#90a4ae", textAlign: "center", marginBottom: 20, fontSize: 14 }}>Acesse sua conta do bolão</p>
          <label style={styles.label}>Usuário</label>
          <input value={u} onChange={e => setU(e.target.value)} style={styles.input} placeholder="seu_usuario" autoCapitalize="none" />
          <label style={styles.label}>Senha</label>
          <PasswordInput value={p} onChange={setP} onEnter={handle} placeholder="••••••" />
          {err && <p style={styles.errMsg}>{err}</p>}
          <button onClick={handle} style={{ ...styles.btn, ...styles.btnFull, marginTop: 8 }}>Entrar</button>
          <p style={{ textAlign: "center", color: "#546e7a", fontSize: 13, marginTop: 16 }}>
            Não tem conta?{" "}
            <button onClick={() => setScreen("register")} style={styles.linkBtn}>Cadastrar-se</button>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── REGISTER ─────────────────────────────────────────────────────────────────
function RegisterScreen({ allUsers, setUsers, setCurrentUser, setScreen, isDesktop }) {
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState({});
  const [usernameOk, setUsernameOk] = useState(null);

  const checkUsername = (val) => {
    const clean = val.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    setUsername(clean);
    if (!clean) { setUsernameOk(null); return; }
    setUsernameOk(!allUsers.find(u => u.username.toLowerCase() === clean));
  };

  const handle = async () => {
    const errs = {};
    if (!displayName.trim()) errs.displayName = "Nome é obrigatório";
    if (!username) errs.username = "Usuário é obrigatório";
    if (usernameOk === false) errs.username = "Usuário já existe";
    if (password.length < 4) errs.password = "Senha mínima 4 caracteres";
    if (password !== confirm) errs.confirm = "Senhas não conferem";
    if (Object.keys(errs).length) { setErrors(errs); return; }

    // Re-check against the freshest user list to avoid duplicate usernames
    // created by two people registering at the same time.
    let latest = allUsers;
    try {
      const remote = await storage.get("bolao:users");
      if (remote) latest = [ADMIN_USER, ...JSON.parse(remote.value).filter(x => !x.isAdmin)];
    } catch {}
    if (latest.find(u => u.username.toLowerCase() === username.toLowerCase())) {
      setErrors({ username: "Usuário já existe" });
      return;
    }

    const newUser = { id: Date.now(), username, displayName: displayName.trim(), passwordHash: hashPassword(password) };
    const merged = [...latest.filter(u => !u.isAdmin), newUser];
    setUsers(merged);
    setCurrentUser(newUser);
    setScreen("home");
  };

  return (
    <div className="app-page" style={isDesktop ? styles.authPageDesktop : styles.page}>
      <div style={isDesktop ? styles.authCard : {}}>
        <TopBar title="Criar Conta" onBack={() => setScreen("landing")} />
        <div style={styles.formBox}>
          <div style={{ fontSize: 36, textAlign: "center", marginBottom: 16 }}>👤</div>

          <label style={styles.label}>Nome (aparece no ranking) *</label>
          <input value={displayName} onChange={e => setDisplayName(e.target.value)} style={{ ...styles.input, ...(errors.displayName ? styles.inputErr : {}) }} placeholder="Ex: Carlos Silva" />
          {errors.displayName && <p style={styles.errMsg}>{errors.displayName}</p>}

          <label style={styles.label}>Usuário (para login) *</label>
          <div style={{ position: "relative" }}>
            <input value={username} onChange={e => checkUsername(e.target.value)} style={{ ...styles.input, ...(errors.username ? styles.inputErr : {}), paddingRight: 36 }} placeholder="Ex: carlos_silva" autoCapitalize="none" />
            {usernameOk === true  && <span style={styles.usernameOk}>✓</span>}
            {usernameOk === false && <span style={styles.usernameErr}>✗</span>}
          </div>
          {errors.username && <p style={styles.errMsg}>{errors.username}</p>}
          {usernameOk === false && <p style={styles.errMsg}>Usuário já cadastrado. Escolha outro.</p>}
          {usernameOk === true  && <p style={{ color: "#4caf50", fontSize: 12, marginTop: -8, marginBottom: 10 }}>✓ Usuário disponível</p>}

          <label style={styles.label}>Senha *</label>
          <PasswordInput value={password} onChange={setPassword} placeholder="Mínimo 4 caracteres" hasError={!!errors.password} />
          {errors.password && <p style={styles.errMsg}>{errors.password}</p>}

          <label style={styles.label}>Confirmar senha *</label>
          <PasswordInput value={confirm} onChange={setConfirm} onEnter={handle} placeholder="Repita a senha" hasError={!!errors.confirm} />
          {errors.confirm && <p style={styles.errMsg}>{errors.confirm}</p>}

          <button onClick={handle} style={{ ...styles.btn, ...styles.btnFull, marginTop: 8 }}>Criar Conta e Entrar</button>
          <p style={{ textAlign: "center", color: "#546e7a", fontSize: 13, marginTop: 14 }}>
            Já tem conta?{" "}
            <button onClick={() => setScreen("login")} style={styles.linkBtn}>Entrar</button>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── DEFINIR NOVA SENHA (obrigatório após reset feito pelo admin) ─────────────
function ResetPasswordScreen({ currentUser, setUsers, setCurrentUser, setScreen, isDesktop }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState({});

  const handle = () => {
    const errs = {};
    if (password.length < 4) errs.password = "Senha mínima 4 caracteres";
    if (password !== confirm) errs.confirm = "Senhas não conferem";
    if (Object.keys(errs).length) { setErrors(errs); return; }

    const newHash = hashPassword(password);
    setUsers(prev => prev.map(x => x.id === currentUser.id ? { ...x, passwordHash: newHash, mustResetPassword: false } : x));
    setCurrentUser({ ...currentUser, passwordHash: newHash, mustResetPassword: false });
    setScreen("home");
  };

  return (
    <div className="app-page" style={isDesktop ? styles.authPageDesktop : styles.page}>
      <div style={isDesktop ? styles.authCard : {}}>
        <TopBar title="Definir Nova Senha" onBack={() => {}} />
        <div style={styles.formBox}>
          <div style={{ fontSize: 40, textAlign: "center", marginBottom: 8 }}>🔑</div>
          <p style={{ color: "#90a4ae", textAlign: "center", marginBottom: 4, fontSize: 14 }}>
            Sua senha foi resetada pelo administrador.
          </p>
          <p style={{ color: "#ffd600", textAlign: "center", marginBottom: 20, fontSize: 13, fontWeight: 700 }}>
            Defina uma nova senha para continuar
          </p>
          <label style={styles.label}>Nova senha</label>
          <PasswordInput value={password} onChange={setPassword} placeholder="Mínimo 4 caracteres" hasError={!!errors.password} />
          {errors.password && <p style={styles.errMsg}>{errors.password}</p>}
          <label style={styles.label}>Confirmar nova senha</label>
          <PasswordInput value={confirm} onChange={setConfirm} onEnter={handle} placeholder="Repita a senha" hasError={!!errors.confirm} />
          {errors.confirm && <p style={styles.errMsg}>{errors.confirm}</p>}
          <button onClick={handle} style={{ ...styles.btn, ...styles.btnFull, marginTop: 8 }}>Salvar Nova Senha</button>
        </div>
      </div>
    </div>
  );
}

// ─── EDITAR PERFIL (nome + foto) ───────────────────────────────────────────────
const MAX_PHOTO_BYTES = 600 * 1024; // limite de segurança antes de comprimir

function compressImageToDataUrl(file, maxSize = 240, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => { img.src = e.target.result; };
    reader.onerror = reject;
    img.onload = () => {
      let { width, height } = img;
      if (width > height) { if (width > maxSize) { height = Math.round(height * maxSize / width); width = maxSize; } }
      else { if (height > maxSize) { width = Math.round(width * maxSize / height); height = maxSize; } }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function EditProfileScreen({ currentUser, setUsers, setCurrentUser, setScreen, addToast }) {
  const [displayName, setDisplayName] = useState(currentUser.displayName);
  const [photoUrl, setPhotoUrl] = useState(currentUser.photoUrl || null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Selecione um arquivo de imagem."); return; }
    setError(""); setUploading(true);
    try {
      const dataUrl = await compressImageToDataUrl(file);
      if (dataUrl.length > MAX_PHOTO_BYTES) {
        setError("Imagem muito grande mesmo após compressão. Tente outra foto.");
      } else {
        setPhotoUrl(dataUrl);
      }
    } catch {
      setError("Não foi possível processar essa imagem.");
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSave = () => {
    const name = displayName.trim();
    if (!name) { setError("O nome não pode ficar em branco."); return; }
    setUsers(prev => prev.map(x => x.id === currentUser.id ? { ...x, displayName: name, photoUrl } : x));
    setCurrentUser({ ...currentUser, displayName: name, photoUrl });
    addToast?.("✅ Perfil atualizado!", "success");
    setScreen("home");
  };

  return (
    <div className="app-page" style={styles.page}>
      <TopBar title="Editar Perfil" onBack={() => setScreen("home")} />
      <div style={styles.formBox}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 20 }}>
          <div style={{ position: "relative" }}>
            <Avatar name={displayName || currentUser.displayName} photoUrl={photoUrl} size={88} />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={{ position: "absolute", bottom: -2, right: -2, width: 32, height: 32, borderRadius: "50%", background: "#ffd600", border: "2px solid #0a0e1a", color: "#0a0e1a", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              title="Trocar foto"
            >
              {uploading ? "⏳" : "📷"}
            </button>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: "none" }} />
          {photoUrl && (
            <button onClick={() => setPhotoUrl(null)} style={{ background: "none", border: "none", color: "#546e7a", fontSize: 12, marginTop: 10, cursor: "pointer", textDecoration: "underline" }}>
              Remover foto
            </button>
          )}
        </div>

        <label style={styles.label}>Nome (aparece no ranking)</label>
        <input value={displayName} onChange={e => setDisplayName(e.target.value)} style={styles.input} placeholder="Seu nome" />
        {error && <p style={styles.errMsg}>{error}</p>}

        <button onClick={handleSave} style={{ ...styles.btn, ...styles.btnFull, marginTop: 8 }}>Salvar Alterações</button>
      </div>
    </div>
  );
}

// ─── HOME ─────────────────────────────────────────────────────────────────────
function HomeScreen({ currentUser, ranking, setScreen, logout, matches, setActivePhase }) {
  const upcoming = [...matches].filter(m => minutesUntilMatch(m) > 0).sort((a, b) => matchDateTime(a) - matchDateTime(b));
  const nextMatch = upcoming[0];
  // If other matches kick off at the exact same time as the next one, show them all together.
  const nextMatches = nextMatch ? upcoming.filter(m => matchDateTime(m).getTime() === matchDateTime(nextMatch).getTime()) : [];
  const myRank = ranking.findIndex(r => r.id === currentUser.id) + 1;
  const myData = ranking.find(r => r.id === currentUser.id);

  const goToMatch = (m) => {
    setActivePhase(m.phase);
    setScreen("predictions");
  };

  return (
    <div className="app-page" style={styles.page}>
      <div style={styles.hero}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "0 4px" }}>
          <div>
            <p style={{ color: "#78909c", fontSize: 12, margin: "0 0 2px" }}>Bem-vindo,</p>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h2 style={{ margin: 0, fontWeight: 800, fontSize: 20, color: "#fff" }}>{currentUser.displayName}</h2>
              <button
                onClick={() => setScreen("edit-profile")}
                style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 11, padding: 0 }}
                title="Editar perfil"
              >
                ✏️
              </button>
            </div>
          </div>
          <button onClick={logout} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#78909c", padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>Sair</button>
        </div>
        {myData && (
          <div style={styles.myStatsRow}>
            <div style={styles.statBox}><span style={styles.statNum}>{myData.total}</span><span style={styles.statLabel}>pontos</span></div>
            <div style={styles.statBox}><span style={styles.statNum}>{myRank}º</span><span style={styles.statLabel}>posição</span></div>
            <div style={styles.statBox}><span style={styles.statNum}>{myData.exact}</span><span style={styles.statLabel}>cravados</span></div>
          </div>
        )}
        {nextMatches.length > 0 && (
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 11, color: "#ffd600", fontWeight: 700, textAlign: "left" }}>
              ⏰ {nextMatches.length > 1 ? "PRÓXIMOS JOGOS" : "PRÓXIMO JOGO"}
            </span>
            {nextMatches.map(m => (
              <div
                key={m.id}
                onClick={!isLocked(m) ? () => goToMatch(m) : undefined}
                style={{ ...styles.nextMatchBadge, marginTop: 0, ...(isLocked(m) ? {} : { cursor: "pointer", borderColor: "rgba(255,214,0,0.4)", boxShadow: "0 0 0 1px rgba(255,214,0,0.15)" }) }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 10, color: "#78909c" }}>{m.phase}{m.group ? ` • Grupo ${m.group}` : ""}</span>
                  {!isLocked(m) && <span style={{ fontSize: 10, color: "#ffd600", fontWeight: 700, background: "rgba(255,214,0,0.15)", padding: "2px 8px", borderRadius: 10 }}>Apostar →</span>}
                </div>
                <span style={{ fontSize: 14, fontWeight: 800, color: "#fff", margin: "6px 0 3px", display: "block" }}>{m.home} × {m.away}</span>
                <span style={{ fontSize: 11, color: minutesUntilMatch(m) <= 30 ? "#ff7043" : "#90a4ae" }}>
                  {isLocked(m) ? "🔒 Palpites encerrados" : `🕐 Fecha em ${formatCountdown(minutesUntilMatch(m) - LOCK_MINUTES_BEFORE)}`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={styles.cardGrid}>
        {[
          { icon: "⚽", label: "Meus Palpites", color: "#00bcd4", screen: "predictions" },
          { icon: "🥇", label: "Artilheiro & Garçom", color: "#ffd600", screen: "awards" },
          { icon: "🏅", label: "Classificação",  color: "#ff9800", screen: "ranking" },
          { icon: "📊", label: "Resultados",      color: "#4caf50", screen: "results" },
          { icon: "🏆", label: "Grupos",          color: "#ab47bc", screen: "groups" },
          ...(currentUser.isAdmin ? [{ icon: "🔐", label: "Admin", color: "#ef5350", screen: "admin" }] : []),
        ].map(c => (
          <button key={c.screen} onClick={() => setScreen(c.screen)} style={{ ...styles.actionCard, borderColor: c.color + "55", background: c.color + "18" }}>
            <span style={{ fontSize: 28 }}>{c.icon}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#e0e0e0", marginTop: 6 }}>{c.label}</span>
          </button>
        ))}
      </div>

      {ranking.length > 0 && (
        <div style={{ margin: "0 16px" }}>
          <h3 style={styles.sectionTitle}>🥇 Top 3</h3>
          {ranking.slice(0, 3).map((p, i) => (
            <div key={p.id} style={{ ...styles.rankRow, ...(p.id === currentUser.id ? { background: "rgba(255,214,0,0.06)", borderRadius: 10, padding: "8px 10px" } : {}) }}>
              <span style={{ fontSize: 20, width: 28 }}>{["🥇","🥈","🥉"][i]}</span>
              <Avatar name={p.displayName} photoUrl={p.photoUrl} />
              <span style={{ flex: 1, marginLeft: 10, fontWeight: 600, fontSize: 14 }}>{p.displayName}</span>
              <span style={{ fontWeight: 800, fontSize: 16, color: "#ffd600" }}>{p.total} pts</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── ALL PREDICTIONS MODAL ────────────────────────────────────────────────────
function AllPredictionsModal({ match, users, predictions, onClose }) {
  const mult = PHASE_MULTIPLIERS[match.phase] || 1;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center", backdropFilter: "blur(4px)" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#0f1e30", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 480, padding: "20px 20px 40px", border: "1px solid rgba(255,255,255,0.12)", borderBottom: "none", maxHeight: "80vh", overflowY: "auto" }}>
        <div style={{ width: 40, height: 4, background: "#37474f", borderRadius: 2, margin: "0 auto 18px" }} />
        <h3 style={{ margin: "0 0 2px", fontWeight: 800, fontSize: 16, color: "#fff" }}>{match.home} × {match.away}</h3>
        <p style={{ margin: "0 0 14px", color: "#78909c", fontSize: 12 }}>📅 {match.date} {match.time} • {match.phase} • multiplicador ×{mult}</p>

        {match.homeScore !== null && (
          <div style={{ background: "rgba(0,188,212,0.1)", border: "1px solid rgba(0,188,212,0.3)", borderRadius: 10, padding: "10px 14px", textAlign: "center", marginBottom: 14 }}>
            <span style={{ color: "#90a4ae", fontSize: 12 }}>Resultado oficial: </span>
            <strong style={{ color: "#fff", fontSize: 20 }}>{match.homeScore} × {match.awayScore}</strong>
          </div>
        )}

        <p style={{ color: "#546e7a", fontSize: 11, marginBottom: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Palpites dos participantes</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {users.map(u => {
            const pred = predictions[u.id]?.[match.id];
            const noPred = !hasPred(pred);
            const pts = (!noPred && match.homeScore !== null) ? calcPoints(pred, match, match.phase) : null;
            const res = pts !== null ? getResultLabel(pts, match.phase) : null;
            return (
              <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, background: noPred ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.05)", borderRadius: 10, padding: "10px 12px", border: `1px solid ${res ? res.color + "44" : "rgba(255,255,255,0.07)"}` }}>
                <Avatar name={u.displayName} size={34} photoUrl={u.photoUrl} />
                <span style={{ flex: 1, fontWeight: 600, fontSize: 13, color: noPred ? "#546e7a" : "#e0e0e0" }}>{u.displayName}</span>
                {noPred ? (
                  <span style={{ color: "#37474f", fontSize: 12, fontStyle: "italic" }}>sem palpite</span>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 800, fontSize: 17, color: "#fff", background: "rgba(255,255,255,0.09)", padding: "4px 12px", borderRadius: 8, letterSpacing: 1 }}>
                      {pred.home} × {pred.away}
                    </span>
                    {res && (
                      <span style={{ fontSize: 11, fontWeight: 800, color: res.color, minWidth: 50, textAlign: "right" }}>
                        {pts > 0 ? `+${pts}pts` : "0pts"}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <button onClick={onClose} style={{ marginTop: 20, width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#90a4ae", padding: "12px", fontSize: 14, cursor: "pointer", fontWeight: 600 }}>Fechar</button>
      </div>
    </div>
  );
}

// ─── PREDICTIONS ──────────────────────────────────────────────────────────────
// ─── ARTILHEIRO E GARÇOM DA COPA ───────────────────────────────────────────────
function AwardsScreen({ currentUser, matches, awardPicks, officialAwards, users, handleSaveAwardPick, setScreen }) {
  const myPicks = awardPicks[currentUser.id] || {};
  const locked = areAwardPicksLocked(matches);
  const [topScorer, setTopScorer] = useState(myPicks.topScorer || "");
  const [topAssist, setTopAssist] = useState(myPicks.topAssist || "");
  const [savedAlert, setSavedAlert] = useState(false);

  const hasChanges = topScorer.trim() !== (myPicks.topScorer || "") || topAssist.trim() !== (myPicks.topAssist || "");

  const handleSave = async () => {
    await handleSaveAwardPick(currentUser.id, { topScorer: topScorer.trim(), topAssist: topAssist.trim() });
    setSavedAlert(true);
    setTimeout(() => setSavedAlert(false), 3000);
  };

  return (
    <div className="app-page" style={styles.page}>
      <TopBar title="🥇 Artilheiro & Garçom" onBack={() => setScreen("home")} />

      <div style={{ padding: "16px 16px 0" }}>
        <div style={styles.multBadge}>
          <strong style={{ color: "#ffd600" }}>+{AWARD_BONUS_POINTS} pontos</strong>
          <span style={{ marginLeft: 6, color: "#78909c" }}>para cada acerto • escolha só 1 de cada</span>
        </div>

        {locked ? (
          <div style={{ background: "rgba(239,83,80,0.08)", border: "1px solid rgba(239,83,80,0.25)", borderRadius: 10, padding: "10px 14px", marginTop: 12, fontSize: 12, color: "#ef5350" }}>
            🔒 As escolhas foram encerradas — a Segunda Fase já terminou.
          </div>
        ) : (
          <div style={{ background: "rgba(255,152,0,0.08)", border: "1px solid rgba(255,152,0,0.25)", borderRadius: 10, padding: "10px 14px", marginTop: 12, fontSize: 12, color: "#ff9800" }}>
            ⏰ Você pode alterar até o fim da Segunda Fase.
          </div>
        )}
      </div>

      {!locked && (
        <div style={{ padding: "16px" }}>
          <label style={styles.label}>⚽ Artilheiro da Copa (mais gols)</label>
          <PlayerAutocomplete
            value={topScorer}
            onChange={v => setTopScorer(v)}
            placeholder="Digite o nome do jogador"
          />

          <label style={styles.label}>🎯 Garçom da Copa (mais assistências)</label>
          <PlayerAutocomplete
            value={topAssist}
            onChange={v => setTopAssist(v)}
            placeholder="Digite o nome do jogador"
          />

          <button onClick={handleSave} disabled={!hasChanges} style={{ ...styles.btn, ...styles.btnFull, marginTop: 8, opacity: hasChanges ? 1 : 0.5 }}>
            💾 Salvar Escolhas
          </button>
          {savedAlert && <p style={{ color: "#4caf50", textAlign: "center", fontSize: 13, marginTop: 10 }}>✅ Escolhas salvas!</p>}
        </div>
      )}

      {locked && (
        <div style={{ padding: "0 16px 32px" }}>
          <p style={{ color: "#546e7a", fontSize: 11, marginBottom: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Palpites de todos os participantes
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {users.map(u => {
              const picks = awardPicks[u.id] || {};
              const hasAny = picks.topScorer || picks.topAssist;
              const scorerHit = officialAwards.topScorer && picks.topScorer === officialAwards.topScorer;
              const assistHit = officialAwards.topAssist && picks.topAssist === officialAwards.topAssist;
              return (
                <div
                  key={u.id}
                  style={{
                    background: u.id === currentUser.id ? "rgba(255,214,0,0.06)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${u.id === currentUser.id ? "rgba(255,214,0,0.25)" : "rgba(255,255,255,0.08)"}`,
                    borderRadius: 10, padding: "10px 12px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <Avatar name={u.displayName} size={26} photoUrl={u.photoUrl} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#e0e0e0" }}>{u.displayName}{u.id === currentUser.id ? " (você)" : ""}</span>
                  </div>
                  {hasAny ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingLeft: 4 }}>
                      <span style={{ fontSize: 12, color: scorerHit ? "#4caf50" : "#cfd8dc" }}>
                        ⚽ {picks.topScorer || "—"} {scorerHit && <strong>✓ +{AWARD_BONUS_POINTS}pts</strong>}
                      </span>
                      <span style={{ fontSize: 12, color: assistHit ? "#4caf50" : "#cfd8dc" }}>
                        🎯 {picks.topAssist || "—"} {assistHit && <strong>✓ +{AWARD_BONUS_POINTS}pts</strong>}
                      </span>
                    </div>
                  ) : (
                    <span style={{ fontSize: 12, color: "#37474f", fontStyle: "italic", paddingLeft: 4 }}>sem palpite</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function PredictionsScreen({ currentUser, users, matches, phases, activePhase, setActivePhase, tempPredictions, setTempPredictions, predictions, handleSavePredictions, savedAlert, setScreen }) {
  const mult = PHASE_MULTIPLIERS[activePhase] || 1;
  const filtered = [...matches.filter(m => m.phase === activePhase)].sort((a, b) => {
    const aLocked = isLocked(a);
    const bLocked = isLocked(b);
    if (aLocked !== bLocked) return aLocked ? 1 : -1; // open matches first, locked/finished go last
    return matchDateTime(a) - matchDateTime(b); // within each group, soonest first
  });
  const savedPreds = predictions[currentUser.id] || {};
  const [modalMatch, setModalMatch] = useState(null);

  const setPred = (id, side, val) => {
    const n = val === "" ? "" : Math.max(0, parseInt(val) || 0);
    setTempPredictions(p => ({ ...p, [id]: { ...p[id], [side]: n } }));
  };

  const hasPendingChanges = filtered.some(m => {
    if (isLocked(m)) return false;
    const temp = tempPredictions[m.id];
    const saved = savedPreds[m.id];
    if (!temp) return false;
    return temp.home !== saved?.home || temp.away !== saved?.away;
  });

  return (
    <div className="app-page" style={styles.page}>
      {modalMatch && <AllPredictionsModal match={modalMatch} users={users} predictions={predictions} onClose={() => setModalMatch(null)} />}
      <TopBar title={`⚽ Palpites — ${currentUser.displayName}`} onBack={() => setScreen("home")} />

      <div style={styles.multBadge}>
        <span>📐 Multiplicador: </span><strong style={{ color: "#ffd600" }}>×{mult}</strong>
        <span style={{ marginLeft: 8, color: "#78909c" }}>| Placar: {10*mult}pts | Resultado: {5*mult}pts</span>
      </div>

      <div style={styles.tabRow}>
        {phases.map(ph => (
          <button key={ph} onClick={() => setActivePhase(ph)} style={{ ...styles.tab, ...(activePhase === ph ? styles.tabActive : {}) }}>
            {ph.replace(" de Final","").replace("Fase de ","")}
          </button>
        ))}
      </div>

      <div style={{ padding: "0 16px 100px" }}>
        {filtered.map(m => {
          const mins = minutesUntilMatch(m);
          const locked = isLocked(m);
          const pred = tempPredictions[m.id] || {};
          const saved = savedPreds[m.id];
          const hasSaved = hasPred(saved);
          const result = m.homeScore !== null && hasSaved ? getResultLabel(calcPoints(saved, m, m.phase), m.phase) : null;
          const closingSoon = mins > LOCK_MINUTES_BEFORE && mins <= NOTIFY_MINUTES_BEFORE;

          return (
            <div
              key={m.id}
              onClick={locked ? () => setModalMatch(m) : undefined}
              style={{ ...styles.matchCard, ...(locked ? { borderColor: "rgba(239,83,80,0.25)", cursor: "pointer" } : closingSoon ? { borderColor: "rgba(255,152,0,0.4)", boxShadow: "0 0 0 1px rgba(255,152,0,0.2)" } : {}) }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 4 }}>
                <span style={{ color: "#78909c", fontSize: 11 }}>📅 {m.date} {m.time}</span>
                {m.group && <span style={styles.groupBadge}>Grupo {m.group}</span>}
                {locked && m.homeScore === null && <span style={{ background: "rgba(239,83,80,0.15)", color: "#ef5350", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10 }}>🔒 Toque p/ ver palpites</span>}
                {locked && m.homeScore !== null && <span style={{ background: "rgba(76,175,80,0.15)", color: "#4caf50", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10 }}>✅ Toque p/ ver resultados</span>}
                {!locked && mins <= NOTIFY_MINUTES_BEFORE && <span style={{ background: "rgba(255,152,0,0.15)", color: "#ff9800", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10, animation: "pulse 1.5s infinite" }}>⏰ Fecha em {formatCountdown(mins - LOCK_MINUTES_BEFORE)}</span>}
                {!locked && mins > NOTIFY_MINUTES_BEFORE && <span style={{ color: "#546e7a", fontSize: 10 }}>🕐 {formatCountdown(mins - LOCK_MINUTES_BEFORE)} para fechar</span>}
              </div>

              <div style={styles.matchRow}>
                <span style={styles.team}>{m.home}</span>
                {locked ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ ...styles.scoreBox, opacity: hasSaved ? 1 : 0.35 }}>{hasSaved ? saved.home : "–"}</span>
                    <span style={{ color: "#546e7a" }}>×</span>
                    <span style={{ ...styles.scoreBox, opacity: hasSaved ? 1 : 0.35 }}>{hasSaved ? saved.away : "–"}</span>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <input type="number" min={0} max={20} value={pred.home ?? ""} onChange={e => setPred(m.id, "home", e.target.value)} style={styles.scoreInput} placeholder="–" />
                    <span style={{ color: "#546e7a", fontSize: 18 }}>×</span>
                    <input type="number" min={0} max={20} value={pred.away ?? ""} onChange={e => setPred(m.id, "away", e.target.value)} style={styles.scoreInput} placeholder="–" />
                  </div>
                )}
                <span style={styles.team}>{m.away}</span>
              </div>

              {m.homeScore !== null && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.07)", textAlign: "center" }}>
                  <span style={{ color: "#90a4ae", fontSize: 11 }}>Resultado: </span>
                  <strong style={{ color: "#e0e0e0" }}>{m.homeScore} × {m.awayScore}</strong>
                  {result && <span style={{ color: result.color, marginLeft: 10, fontSize: 11, fontWeight: 700 }}>{result.label} (+{calcPoints(saved, m, m.phase)} pts)</span>}
                  {!hasSaved && <span style={{ color: "#546e7a", marginLeft: 10, fontSize: 11 }}>sem palpite (0 pts)</span>}
                </div>
              )}
              <span style={{ color: "#546e7a", fontSize: 10, display: "block", textAlign: "center", marginTop: 4 }}>🏟 {m.stadium}</span>
            </div>
          );
        })}
      </div>

      {hasPendingChanges && (
        <div style={styles.bottomBar}>
          <button onClick={handleSavePredictions} style={styles.btnSave}>💾 Salvar Palpites</button>
        </div>
      )}
      {!hasPendingChanges && (
        <div style={{ ...styles.bottomBar, background: "rgba(10,14,26,0.8)" }}>
          <p style={{ textAlign: "center", color: "#546e7a", margin: 0, fontSize: 13 }}>
            {savedAlert ? "✅ Palpites salvos!" : "Todos os palpites estão salvos"}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── RANKING ──────────────────────────────────────────────────────────────────
// ─── PALPITES DE UM JOGADOR (modal a partir do ranking) ───────────────────────
// Mostra só os jogos cujo período de apostas já encerrou — nunca revela
// palpites de jogos ainda abertos, mesmo no histórico pessoal de outro jogador.
function PlayerPredictionsModal({ player, matches, predictions, onClose }) {
  const myPreds = predictions[player.id] || {};
  const finished = [...matches.filter(m => isLocked(m))].sort((a, b) => matchDateTime(b) - matchDateTime(a));

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center", backdropFilter: "blur(4px)" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#0f1e30", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 480, padding: "20px 20px 32px", border: "1px solid rgba(255,255,255,0.12)", borderBottom: "none", maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ width: 40, height: 4, background: "#37474f", borderRadius: 2, margin: "0 auto 18px" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <Avatar name={player.displayName} size={40} photoUrl={player.photoUrl} />
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontWeight: 800, fontSize: 16, color: "#fff" }}>{player.displayName}</h3>
            <p style={{ margin: 0, color: "#78909c", fontSize: 11 }}>{player.total} pontos • {player.exact} placar(es) cravado(s)</p>
          </div>
          <button
            onClick={onClose}
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", color: "#90a4ae", fontSize: 16, cursor: "pointer", flexShrink: 0 }}
            title="Fechar"
          >
            ✕
          </button>
        </div>

        <p style={{ color: "#546e7a", fontSize: 11, marginBottom: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
          Palpites em jogos encerrados
        </p>

        {finished.length === 0 && (
          <p style={{ color: "#546e7a", fontSize: 13, textAlign: "center", padding: "20px 0" }}>Nenhum jogo encerrado ainda.</p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {finished.map(m => {
            const pred = myPreds[m.id];
            const noPred = !hasPred(pred);
            const pts = (noPred || m.homeScore === null) ? 0 : calcPoints(pred, m, m.phase);
            const res = (noPred || m.homeScore === null) ? null : getResultLabel(pts, m.phase);
            return (
              <div key={m.id} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${res ? res.color + "33" : "rgba(255,255,255,0.07)"}`, borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 10, color: "#78909c" }}>{m.phase}{m.group ? ` • Grupo ${m.group}` : ""}</span>
                  <span style={{ fontSize: 10, color: "#546e7a" }}>{m.date}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#e0e0e0", flex: 1 }}>{m.home}</span>
                  {m.homeScore !== null && (
                    <span style={{ fontSize: 11, color: "#78909c", whiteSpace: "nowrap" }}>{m.homeScore}×{m.awayScore}</span>
                  )}
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#e0e0e0", flex: 1, textAlign: "right" }}>{m.away}</span>
                </div>
                <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  {noPred ? (
                    <span style={{ fontSize: 12, color: "#37474f", fontStyle: "italic" }}>sem palpite</span>
                  ) : (
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#cfd8dc" }}>Palpite: {pred.home} × {pred.away}</span>
                  )}
                  {res && <span style={{ fontSize: 11, fontWeight: 700, color: res.color }}>{pts > 0 ? `+${pts}pts` : "0pts"}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RankingScreen({ ranking, currentUser, setScreen, matches, predictions }) {
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  return (
    <div className="app-page" style={styles.page}>
      {selectedPlayer && (
        <PlayerPredictionsModal
          player={selectedPlayer}
          matches={matches}
          predictions={predictions}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
      <TopBar title="🏅 Classificação" onBack={() => setScreen(currentUser ? "home" : "landing")} />
      <div style={{ padding: "12px 16px 32px" }}>
        <p style={{ color: "#546e7a", textAlign: "center", fontSize: 12, marginBottom: 16 }}>
          {ranking.length} participante(s) • Desempate: placares cravados • Toque num jogador para ver os palpites
        </p>
        {ranking.map((p, i) => (
          <div
            key={p.id}
            onClick={() => setSelectedPlayer(p)}
            style={{ ...styles.rankCard, cursor: "pointer", ...(i===0?styles.rankFirst:i===1?styles.rankSecond:i===2?styles.rankThird:{}), ...(currentUser?.id===p.id?{outline:"2px solid #ffd600"}:{}) }}
          >
            <span style={{ fontSize: 22, width: 32, textAlign: "center" }}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}º`}</span>
            <Avatar name={p.displayName} size={40} photoUrl={p.photoUrl} />
            <div style={{ flex: 1, marginLeft: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: currentUser?.id===p.id?"#ffd600":"#e0e0e0" }}>{p.displayName} {currentUser?.id===p.id&&"(você)"}</div>
              <div style={{ fontSize: 11, color: "#78909c" }}>🎯 {p.exact} placar(es) cravado(s)</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: i===0?"#ffd600":"#e0e0e0" }}>{p.total}</div>
              <div style={{ fontSize: 10, color: "#546e7a" }}>pontos</div>
            </div>
          </div>
        ))}
        {ranking.length === 0 && <p style={{ color: "#546e7a", textAlign: "center" }}>Nenhum participante ainda.</p>}
      </div>
    </div>
  );
}

// ─── CLASSIFICAÇÃO DE GRUPOS ───────────────────────────────────────────────────
// Calcula pontos, saldo de gols, gols pró/contra de cada seleção a partir dos
// jogos da Fase de Grupos já com placar lançado.
function computeGroupStandings(matches) {
  const groupMatches = matches.filter(m => m.phase === "Fase de Grupos" && m.group);
  const groups = {};
  for (const m of groupMatches) {
    if (!groups[m.group]) groups[m.group] = {};
    const table = groups[m.group];
    if (!table[m.home]) table[m.home] = { team: m.home, pts: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, j: 0 };
    if (!table[m.away]) table[m.away] = { team: m.away, pts: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, j: 0 };
    if (m.homeScore === null || m.awayScore === null) continue;
    const home = table[m.home], away = table[m.away];
    home.j++; away.j++;
    home.gp += m.homeScore; home.gc += m.awayScore;
    away.gp += m.awayScore; away.gc += m.homeScore;
    if (m.homeScore > m.awayScore) { home.v++; home.pts += 3; away.d++; }
    else if (m.homeScore < m.awayScore) { away.v++; away.pts += 3; home.d++; }
    else { home.e++; away.e++; home.pts += 1; away.pts += 1; }
  }
  const result = {};
  for (const g of Object.keys(groups).sort()) {
    result[g] = Object.values(groups[g])
      .map(t => ({ ...t, sg: t.gp - t.gc }))
      .sort((a, b) => b.pts - a.pts || b.sg - a.sg || b.gp - a.gp);
  }
  return result;
}

// ─── GRUPOS / CHAVEAMENTO ───────────────────────────────────────────────────────
function GroupsScreen({ matches, setScreen, currentUser }) {
  const groupMatches = matches.filter(m => m.phase === "Fase de Grupos");
  const groupsFinished = groupMatches.length > 0 && groupMatches.every(m => m.homeScore !== null);
  const [view, setView] = useState(groupsFinished ? "bracket" : "groups");
  const standings = computeGroupStandings(matches);
  const groupKeys = Object.keys(standings);

  const knockoutPhases = ["Segunda Fase", "Oitavas de Final", "Quartas de Final", "Semifinal", "Disputa 3º Lugar", "Final"];
  const knockoutByPhase = {};
  for (const ph of knockoutPhases) {
    const list = matches.filter(m => m.phase === ph);
    if (list.length) knockoutByPhase[ph] = [...list].sort((a, b) => matchDateTime(a) - matchDateTime(b));
  }

  return (
    <div className="app-page" style={styles.page}>
      <TopBar title="🏆 Grupos & Chaveamento" onBack={() => setScreen(currentUser ? "home" : "landing")} />

      {groupKeys.length > 0 && Object.keys(knockoutByPhase).length > 0 && (
        <div style={{ display: "flex", gap: 8, padding: "12px 16px 0" }}>
          <button onClick={() => setView("groups")} style={{ flex: 1, background: view === "groups" ? "#ffd600" : "rgba(255,255,255,0.07)", border: "none", borderRadius: 10, color: view === "groups" ? "#0a0e1a" : "#90a4ae", fontWeight: 700, fontSize: 13, padding: "9px", cursor: "pointer" }}>
            📋 Grupos
          </button>
          <button onClick={() => setView("bracket")} style={{ flex: 1, background: view === "bracket" ? "#ffd600" : "rgba(255,255,255,0.07)", border: "none", borderRadius: 10, color: view === "bracket" ? "#0a0e1a" : "#90a4ae", fontWeight: 700, fontSize: 13, padding: "9px", cursor: "pointer" }}>
            🏆 Mata-mata
          </button>
        </div>
      )}

      {groupKeys.length === 0 && (
        <p style={{ color: "#546e7a", textAlign: "center", padding: "40px 24px" }}>
          Os jogos ainda não foram carregados. Peça ao admin para buscar a tabela oficial.
        </p>
      )}

      {/* ── TABELA DOS GRUPOS ── */}
      {view === "groups" && groupKeys.length > 0 && (
        <div style={{ padding: "12px 16px 32px" }}>
          {groupKeys.map(g => (
            <div key={g} style={{ marginBottom: 18 }}>
              <h3 style={{ color: "#ffd600", fontSize: 14, fontWeight: 800, margin: "0 0 8px" }}>Grupo {g}</h3>
              <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 28px 28px 28px 28px", padding: "6px 10px", background: "rgba(255,255,255,0.05)", fontSize: 10, color: "#78909c", fontWeight: 700 }}>
                  <span>Seleção</span><span style={{ textAlign: "center" }}>J</span><span style={{ textAlign: "center" }}>SG</span><span style={{ textAlign: "center" }}>GP</span><span style={{ textAlign: "center" }}>Pts</span>
                </div>
                {standings[g].map((t, i) => (
                  <div key={t.team} style={{ display: "grid", gridTemplateColumns: "1fr 28px 28px 28px 28px", padding: "8px 10px", fontSize: 12, color: i < 2 ? "#e0e0e0" : "#78909c", borderTop: "1px solid rgba(255,255,255,0.05)", background: i < 2 ? "rgba(76,175,80,0.06)" : "transparent" }}>
                    <span style={{ fontWeight: i < 2 ? 700 : 500, display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ color: "#546e7a", fontSize: 10, width: 14 }}>{i + 1}º</span>{t.team}
                    </span>
                    <span style={{ textAlign: "center" }}>{t.j}</span>
                    <span style={{ textAlign: "center" }}>{t.sg > 0 ? `+${t.sg}` : t.sg}</span>
                    <span style={{ textAlign: "center" }}>{t.gp}</span>
                    <span style={{ textAlign: "center", fontWeight: 800, color: i < 2 ? "#4caf50" : "#90a4ae" }}>{t.pts}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <p style={{ color: "#546e7a", fontSize: 11, textAlign: "center", marginTop: 8 }}>
            🟢 Os dois primeiros de cada grupo avançam de fase
          </p>
        </div>
      )}

      {/* ── CHAVEAMENTO MATA-MATA ── */}
      {view === "bracket" && (
        <div style={{ padding: "12px 16px 32px" }}>
          {Object.keys(knockoutByPhase).length === 0 && (
            <p style={{ color: "#546e7a", textAlign: "center", padding: "40px 24px" }}>
              O chaveamento aparece aqui assim que a fase de grupos terminar.
            </p>
          )}
          {Object.entries(knockoutByPhase).map(([phase, list]) => (
            <div key={phase} style={{ marginBottom: 18 }}>
              <h3 style={{ color: "#ffd600", fontSize: 14, fontWeight: 800, margin: "0 0 8px" }}>{phase}</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {list.map(m => (
                  <div key={m.id} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ fontSize: 10, color: "#78909c", marginBottom: 6 }}>📅 {m.date} {m.time}</div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#e0e0e0", flex: 1 }}>{m.home}</span>
                      {m.homeScore !== null ? (
                        <span style={{ fontWeight: 800, color: "#fff", background: "rgba(255,255,255,0.08)", padding: "2px 10px", borderRadius: 8, fontSize: 13 }}>{m.homeScore} × {m.awayScore}</span>
                      ) : (
                        <span style={{ color: "#546e7a", fontSize: 11 }}>vs</span>
                      )}
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#e0e0e0", flex: 1, textAlign: "right" }}>{m.away}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── RESULTS ──────────────────────────────────────────────────────────────────
function ResultsScreen({ matches, predictions, users, setScreen, currentUser, phases, activePhase, setActivePhase }) {
  const [expanded, setExpanded] = useState({});
  const toggleExpand = (id) => setExpanded(p => ({ ...p, [id]: !p[id] }));

  // Order: the most recently closed/finished match comes first, then the
  // remaining matches in chronological order (soonest upcoming next, and so on).
  // A finished match stays "first" until the next match's start time arrives.
  const filtered = [...matches.filter(m => m.phase === activePhase)].sort((a, b) => {
    const aTime = matchDateTime(a).getTime();
    const bTime = matchDateTime(b).getTime();
    const nowTs = Date.now();
    const aPast = aTime <= nowTs;
    const bPast = bTime <= nowTs;
    if (aPast && bPast) return bTime - aTime;   // both already started: most recent first
    if (!aPast && !bPast) return aTime - bTime; // both upcoming: soonest first
    return aPast ? -1 : 1;                       // past matches before upcoming ones
  });

  return (
    <div className="app-page" style={styles.page}>
      <TopBar title="📊 Resultados" onBack={() => setScreen(currentUser ? "home" : "landing")} />
      <div style={styles.tabRow}>
        {phases.map(ph => (
          <button key={ph} onClick={() => setActivePhase(ph)} style={{ ...styles.tab, ...(activePhase===ph?styles.tabActive:{}) }}>
            {ph.replace(" de Final","").replace("Fase de ","")}
          </button>
        ))}
      </div>
      <div style={{ padding: "0 16px 32px" }}>
        {filtered.map(m => {
          const locked = isLocked(m);
          const isOpen = !!expanded[m.id];
          return (
            <div key={m.id} style={styles.matchCard}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: "#78909c", fontSize: 11 }}>📅 {m.date} {m.time}</span>
                {m.group && <span style={styles.groupBadge}>Grupo {m.group}</span>}
                {m.homeScore !== null ? <span style={{ color: "#4caf50", fontSize: 11, fontWeight: 700 }}>✅ Finalizado</span> : <span style={{ color: "#546e7a", fontSize: 11 }}>Aguardando...</span>}
              </div>
              <div style={styles.matchRow}>
                <span style={styles.team}>{m.home}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  {m.homeScore !== null ? (
                    <><span style={{ ...styles.scoreBox, background: "#1e3a5f" }}>{m.homeScore}</span><span style={{ color: "#546e7a" }}>×</span><span style={{ ...styles.scoreBox, background: "#1e3a5f" }}>{m.awayScore}</span></>
                  ) : <span style={{ color: "#546e7a", fontSize: 12 }}>– × –</span>}
                </div>
                <span style={styles.team}>{m.away}</span>
              </div>

              {/* Predictions are only ever shown for matches whose betting window
                  has already closed — never reveal picks for open matches. */}
              {locked && users.length > 0 && (
                <>
                  <button
                    onClick={() => toggleExpand(m.id)}
                    style={{ marginTop: 10, width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#90a4ae", fontSize: 12, fontWeight: 600, padding: "7px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                  >
                    {isOpen ? "▲ Ocultar palpites" : "▼ Ver palpites dos participantes"}
                  </button>

                  {isOpen && (
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                      {users.map(u => {
                        const pred = predictions[u.id]?.[m.id];
                        const noPred = !hasPred(pred);
                        const pts = (noPred || m.homeScore === null) ? 0 : calcPoints(pred, m, m.phase);
                        const res = (noPred || m.homeScore === null) ? null : getResultLabel(pts, m.phase);
                        return (
                          <div key={u.id} style={{ display: "flex", alignItems: "center", padding: "4px 0", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                            <Avatar name={u.displayName} size={22} photoUrl={u.photoUrl} />
                            <span style={{ marginLeft: 8, fontSize: 12, color: "#90a4ae", flex: 1 }}>{u.displayName}</span>
                            {noPred
                              ? <span style={{ fontSize: 11, color: "#37474f", fontStyle: "italic" }}>sem palpite</span>
                              : <>
                                  <span style={{ fontSize: 12, fontWeight: 700, color: "#cfd8dc", marginRight: 8 }}>{pred.home}×{pred.away}</span>
                                  {res && <span style={{ fontSize: 11, color: res.color, fontWeight: 700 }}>{pts > 0 ? `+${pts}pts` : "0pts"}</span>}
                                </>
                            }
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── PAINEL ADMIN: VENCEDORES OFICIAIS (ARTILHEIRO/GARÇOM) ────────────────────
function OfficialAwardsPanel({ officialAwards, setOfficialAwards, matches, addToast }) {
  const [topScorer, setTopScorer] = useState(officialAwards.topScorer || "");
  const [topAssist, setTopAssist] = useState(officialAwards.topAssist || "");
  const picksLocked = areAwardPicksLocked(matches);
  const cupFinished = isCupFinished(matches);

  const hasChanges = topScorer.trim() !== (officialAwards.topScorer || "") || topAssist.trim() !== (officialAwards.topAssist || "");

  const handleSave = () => {
    setOfficialAwards({ topScorer: topScorer.trim(), topAssist: topAssist.trim() });
    addToast?.("✅ Vencedores oficiais atualizados! Pontos aplicados a todos os jogadores.", "success");
  };

  return (
    <div style={styles.infoCard2}>
      <strong style={{ color: "#e0e0e0", fontSize: 14 }}>🥇 Artilheiro & Garçom da Copa</strong>
      <p style={{ color: "#78909c", fontSize: 11, margin: "6px 0 12px" }}>
        Defina os vencedores reais. Quem escolheu certo recebe +{AWARD_BONUS_POINTS} pontos por categoria automaticamente.
        {!picksLocked && <span style={{ color: "#ff9800" }}> As escolhas dos jogadores ainda estão abertas (fecham no fim da Segunda Fase).</span>}
      </p>

      {!cupFinished ? (
        <div style={{ background: "rgba(239,83,80,0.08)", border: "1px solid rgba(239,83,80,0.25)", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#ef5350" }}>
          🔒 Disponível somente depois que a Final acontecer e tiver o placar registrado.
        </div>
      ) : (
        <>
          <label style={styles.label}>⚽ Artilheiro real da Copa</label>
          <PlayerAutocomplete value={topScorer} onChange={setTopScorer} placeholder="Digite o nome do jogador" />

          <label style={styles.label}>🎯 Garçom real da Copa</label>
          <PlayerAutocomplete value={topAssist} onChange={setTopAssist} placeholder="Digite o nome do jogador" />

          <button onClick={handleSave} disabled={!hasChanges} style={{ ...styles.btn, ...styles.btnFull, opacity: hasChanges ? 1 : 0.5 }}>
            💾 Salvar Vencedores
          </button>
        </>
      )}
    </div>
  );
}

// ─── SCORE UPDATES PANEL ───────────────────────────────────────────────────────
// Lets the admin check the public fixtures source for newly finished matches
// and apply only the score changes, without touching anything entered manually.
function ScoreUpdatesPanel({ checkingUpdates, checkError, scoreUpdates, handleCheckUpdates, applyScoreUpdates }) {
  return (
    <div style={styles.infoCard2}>
      <strong style={{ color: "#e0e0e0", fontSize: 14 }}>🔄 Verificar Resultados</strong>
      <p style={{ color: "#78909c", fontSize: 11, margin: "6px 0 12px" }}>
        Busca jogos já finalizados na fonte pública e mostra o que mudou, sem sobrescrever resultados que você já inseriu.
      </p>
      <button
        onClick={handleCheckUpdates}
        disabled={checkingUpdates}
        style={{ width: "100%", background: checkingUpdates ? "#37474f" : "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, color: "#e0e0e0", fontWeight: 700, fontSize: 12, padding: "9px", cursor: "pointer" }}
      >
        {checkingUpdates ? "🔍 Verificando..." : "🔄 Verificar Atualizações"}
      </button>
      {checkError && <p style={{ color: "#ef5350", fontSize: 12, textAlign: "center", marginTop: 8 }}>{checkError}</p>}

      {scoreUpdates && scoreUpdates.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ color: "#4caf50", fontWeight: 700, fontSize: 13 }}>✅ {scoreUpdates.length} resultado(s) novo(s)</span>
            <button
              onClick={applyScoreUpdates}
              style={{ background: "linear-gradient(90deg,#00bcd4,#0097a7)", border: "none", borderRadius: 8, color: "#fff", fontWeight: 800, fontSize: 12, padding: "6px 12px", cursor: "pointer" }}
            >
              💾 Aplicar Todos
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {scoreUpdates.map((u) => (
              <div key={u.match.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "#cfd8dc", background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "8px 10px" }}>
                <span>{u.match.home} × {u.match.away}</span>
                <strong style={{ color: "#4caf50" }}>{u.newHomeScore} × {u.newAwayScore}</strong>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── BACKUP PANEL ─────────────────────────────────────────────────────────────
function BackupPanel({ allUsers, matches, predictions, awardPicks, officialAwards, setUsers, setMatches, setPredictions, setAwardPicks, setOfficialAwards, addToast }) {
  const fileInputRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [backupList, setBackupList] = useState(null);
  const [loadingList, setLoadingList] = useState(false);
  const [savingSnapshot, setSavingSnapshot] = useState(false);
  const [restoringKey, setRestoringKey] = useState(null);

  const loadBackupList = async () => {
    setLoadingList(true);
    try {
      const idxRes = await storage.get(BACKUP_INDEX_KEY);
      setBackupList(idxRes ? JSON.parse(idxRes.value) : []);
    } catch {
      setBackupList([]);
    }
    setLoadingList(false);
  };

  useEffect(() => { loadBackupList(); }, []);

  const handleExport = () => {
    const backup = {
      exportedAt: new Date().toISOString(),
      users: allUsers.filter(u => !u.isAdmin),
      matches,
      predictions,
      awardPicks,
      officialAwards,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
    a.href = url;
    a.download = `backup-bolao-copa-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addToast("💾 Backup exportado com sucesso!", "success");
  };

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.users || !data.matches || !data.predictions) throw new Error("Formato inválido");
        const merged = [ADMIN_USER, ...data.users.filter(u => !u.isAdmin)];
        setUsers(merged);
        setMatches(data.matches);
        setPredictions(data.predictions);
        setAwardPicks(data.awardPicks || {});
        setOfficialAwards(data.officialAwards || { topScorer: "", topAssist: "" });
        addToast(`✅ Backup restaurado! (${data.users.length} jogadores, ${data.matches.length} jogos)`, "success");
      } catch {
        addToast("❌ Arquivo de backup inválido.", "warning");
      }
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsText(file);
  };

  // Salva um snapshot manual no próprio Supabase, listado junto com os automáticos.
  const handleSaveSnapshot = async () => {
    setSavingSnapshot(true);
    try {
      const createdAt = new Date().toISOString();
      const snapshot = { createdAt, auto: false, users: allUsers.filter(u => !u.isAdmin), matches, predictions, awardPicks, officialAwards };
      const key = `bolao:backup:${createdAt}`;
      await storage.set(key, JSON.stringify(snapshot));
      const idxRes = await storage.get(BACKUP_INDEX_KEY);
      const index = idxRes ? JSON.parse(idxRes.value) : [];
      const newEntry = { key, createdAt, auto: false, users: snapshot.users.length, matches: snapshot.matches.length };
      const updated = [newEntry, ...index].slice(0, 30);
      await storage.set(BACKUP_INDEX_KEY, JSON.stringify(updated));
      setBackupList(updated);
      addToast("💾 Snapshot salvo na nuvem!", "success");
    } catch {
      addToast("❌ Não foi possível salvar o snapshot agora.", "warning");
    }
    setSavingSnapshot(false);
  };

  const handleRestoreSnapshot = async (entry) => {
    if (!window.confirm(`Restaurar o backup de ${formatBackupDate(entry.createdAt)}? Isso substitui os dados atuais (usuários, jogos e palpites).`)) return;
    setRestoringKey(entry.key);
    try {
      const res = await storage.get(entry.key);
      if (!res) throw new Error("not found");
      const data = JSON.parse(res.value);
      const merged = [ADMIN_USER, ...data.users.filter(u => !u.isAdmin)];
      setUsers(merged);
      setMatches(data.matches);
      setAwardPicks(data.awardPicks || {});
      setOfficialAwards(data.officialAwards || { topScorer: "", topAssist: "" });
      setPredictions(data.predictions);
      addToast(`✅ Backup de ${formatBackupDate(entry.createdAt)} restaurado!`, "success");
    } catch {
      addToast("❌ Não foi possível restaurar esse backup.", "warning");
    }
    setRestoringKey(null);
  };

  return (
    <div style={styles.infoCard2}>
      <strong style={{ color: "#e0e0e0", fontSize: 14 }}>💾 Backup dos Dados</strong>
      <p style={{ color: "#78909c", fontSize: 11, margin: "6px 0 12px" }}>
        Um backup automático é salvo na nuvem todo dia. Você também pode salvar manualmente ou baixar um arquivo.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <button onClick={handleSaveSnapshot} disabled={savingSnapshot} style={{ flex: 1, background: savingSnapshot ? "#37474f" : "linear-gradient(90deg,#7e57c2,#5e35b1)", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 12, padding: "9px", cursor: "pointer" }}>
          {savingSnapshot ? "Salvando..." : "☁️ Salvar Snapshot Agora"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button onClick={handleExport} style={{ flex: 1, background: "linear-gradient(90deg,#00bcd4,#0097a7)", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 12, padding: "9px", cursor: "pointer" }}>
          ⬇️ Exportar Arquivo
        </button>
        <button onClick={() => fileInputRef.current?.click()} disabled={importing} style={{ flex: 1, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, color: "#e0e0e0", fontWeight: 700, fontSize: 12, padding: "9px", cursor: "pointer" }}>
          {importing ? "Importando..." : "⬆️ Importar Arquivo"}
        </button>
        <input ref={fileInputRef} type="file" accept="application/json" onChange={handleImportFile} style={{ display: "none" }} />
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <p style={{ color: "#546e7a", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: 0 }}>Backups na nuvem</p>
        <button onClick={loadBackupList} disabled={loadingList} style={{ background: "none", border: "none", color: "#00bcd4", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
          {loadingList ? "Atualizando..." : "🔄 Atualizar lista"}
        </button>
      </div>

      {backupList === null && <p style={{ color: "#546e7a", fontSize: 12, textAlign: "center", padding: "8px 0" }}>Carregando...</p>}
      {backupList && backupList.length === 0 && <p style={{ color: "#546e7a", fontSize: 12, textAlign: "center", padding: "8px 0" }}>Nenhum backup salvo ainda.</p>}

      {backupList && backupList.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 260, overflowY: "auto" }}>
          {backupList.map(entry => (
            <div key={entry.key} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "8px 10px" }}>
              <span style={{ fontSize: 16 }}>{entry.auto ? "🤖" : "👤"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#e0e0e0" }}>{formatBackupDate(entry.createdAt)}</div>
                <div style={{ fontSize: 10, color: "#78909c" }}>{entry.auto ? "Automático" : "Manual"} • {entry.users} jogadores • {entry.matches} jogos</div>
              </div>
              <button
                onClick={() => handleRestoreSnapshot(entry)}
                disabled={restoringKey === entry.key}
                style={{ background: "rgba(255,214,0,0.12)", border: "1px solid rgba(255,214,0,0.3)", borderRadius: 8, color: "#ffd600", fontSize: 11, fontWeight: 700, padding: "5px 9px", cursor: "pointer", whiteSpace: "nowrap" }}
              >
                {restoringKey === entry.key ? "Restaurando..." : "↩️ Restaurar"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── ADMIN USERS PANEL ───────────────────────────────────────────────────────
function AdminUsersPanel({ allNonAdminUsers, setUsers, addToast }) {
  const [filter, setFilter] = useState("all"); // all | active | inactive
  const inactive = allNonAdminUsers.filter(u => u.inactive);
  const active   = allNonAdminUsers.filter(u => !u.inactive);
  const shown = filter === "inactive" ? inactive : filter === "active" ? active : allNonAdminUsers;

  const toggle = (id) => setUsers(prev => prev.map(x => x.id === id ? { ...x, inactive: !x.inactive } : x));

  const resetPassword = (u) => {
    if (!window.confirm(`Resetar a senha de ${u.displayName} para "1234"? O jogador será obrigado a criar uma nova senha no próximo login.`)) return;
    setUsers(prev => prev.map(x => x.id === u.id ? { ...x, passwordHash: hashPassword("1234"), mustResetPassword: true } : x));
    addToast?.(`🔑 Senha de ${u.displayName} resetada para 1234.`, "success");
  };

  return (
    <div style={styles.infoCard2}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <strong style={{ color: "#e0e0e0", fontSize: 14 }}>👥 Jogadores</strong>
        <div style={{ display: "flex", gap: 4 }}>
          {[["all", `Todos (${allNonAdminUsers.length})`], ["active", `Ativos (${active.length})`], ["inactive", `Inativos (${inactive.length})`]].map(([val, label]) => (
            <button key={val} onClick={() => setFilter(val)} style={{ background: filter === val ? "#ffd600" : "rgba(255,255,255,0.07)", border: "none", borderRadius: 16, padding: "3px 9px", fontSize: 10, fontWeight: 700, color: filter === val ? "#0a0e1a" : "#78909c", cursor: "pointer" }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 && (
        <p style={{ color: "#546e7a", fontSize: 12, textAlign: "center", padding: "12px 0" }}>
          {filter === "inactive" ? "Nenhum jogador inativo." : "Nenhum jogador encontrado."}
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {shown.map(u => (
          <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, background: u.inactive ? "rgba(239,83,80,0.06)" : "rgba(255,255,255,0.04)", borderRadius: 10, padding: "8px 10px", border: `1px solid ${u.inactive ? "rgba(239,83,80,0.25)" : "rgba(255,255,255,0.07)"}` }}>
            <Avatar name={u.displayName} size={30} photoUrl={u.photoUrl} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: u.inactive ? "#546e7a" : "#e0e0e0", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                {u.displayName}
                {u.inactive && <span style={{ fontSize: 10, color: "#ef5350", fontWeight: 700, background: "rgba(239,83,80,0.15)", padding: "1px 6px", borderRadius: 8 }}>INATIVO</span>}
                {u.mustResetPassword && <span style={{ fontSize: 10, color: "#ffd600", fontWeight: 700, background: "rgba(255,214,0,0.15)", padding: "1px 6px", borderRadius: 8 }}>SENHA PENDENTE</span>}
              </div>
              <div style={{ fontSize: 11, color: "#546e7a" }}>@{u.username}</div>
            </div>
            <button
              onClick={() => resetPassword(u)}
              style={{ background: "rgba(255,214,0,0.12)", border: "1px solid rgba(255,214,0,0.3)", borderRadius: 8, color: "#ffd600", fontSize: 11, fontWeight: 700, padding: "5px 9px", cursor: "pointer", whiteSpace: "nowrap" }}
            >
              🔑 Resetar
            </button>
            <button
              onClick={() => toggle(u.id)}
              style={{ background: u.inactive ? "rgba(76,175,80,0.15)" : "rgba(239,83,80,0.15)", border: `1px solid ${u.inactive ? "rgba(76,175,80,0.35)" : "rgba(239,83,80,0.35)"}`, borderRadius: 8, color: u.inactive ? "#4caf50" : "#ef5350", fontSize: 11, fontWeight: 700, padding: "5px 10px", cursor: "pointer", whiteSpace: "nowrap" }}
            >
              {u.inactive ? "✅ Ativar" : "🚫 Desativar"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ADMIN ────────────────────────────────────────────────────────────────────
function AdminScreen({ matches, setMatches, predictions, setPredictions, awardPicks, setAwardPicks, officialAwards, setOfficialAwards, adminScores, setAdminScores, setScreen, handleFetchAI, loadingAI, aiError, aiMatches, setAiMatches, scoreUpdates, checkingUpdates, checkError, handleCheckUpdates, applyScoreUpdates, phases, activePhase, setActivePhase, currentUser, allUsers, allNonAdminUsers, setUsers, addToast }) {
  const filtered = matches.filter(m => m.phase === activePhase);

  if (!currentUser?.isAdmin) return (
    <div className="app-page" style={styles.page}>
      <TopBar title="Acesso Negado" onBack={() => setScreen("home")} />
      <div style={{ textAlign: "center", padding: "60px 24px" }}>
        <div style={{ fontSize: 48 }}>🚫</div>
        <p style={{ color: "#ef5350", marginTop: 12 }}>Acesso restrito ao administrador.</p>
      </div>
    </div>
  );

  const saveScore = (id) => {
    const sc = adminScores[id];
    if (sc?.home === undefined || sc?.away === undefined || sc?.home === "" || sc?.away === "") return;
    setMatches(p => p.map(m => m.id === id ? { ...m, homeScore: Number(sc.home), awayScore: Number(sc.away) } : m));
  };



  return (
    <div className="app-page" style={styles.page}>
      <TopBar title="⚙️ Administrador" onBack={() => setScreen("home")} />
      <div style={{ padding: "0 16px" }}>
        <button onClick={handleFetchAI} disabled={loadingAI} style={{ ...styles.btn, ...styles.btnFull, background: loadingAI ? "#37474f" : "#0288d1", color: "#fff", marginBottom: 6 }}>
          {loadingAI ? "🔍 Buscando jogos da Copa..." : "🌐 Buscar Tabela Oficial da Copa 2026"}
        </button>
        <p style={{ color: "#546e7a", fontSize: 10, textAlign: "center", marginTop: -2, marginBottom: 8 }}>Fonte: dados públicos atualizados diariamente</p>
        {aiError && <p style={{ color: "#ef5350", fontSize: 12, textAlign: "center", marginBottom: 8 }}>{aiError}</p>}

        {aiMatches && (
          <div style={{ background: "rgba(2,136,209,0.08)", border: "1px solid rgba(2,136,209,0.3)", borderRadius: 12, padding: "12px", marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ color: "#0288d1", fontWeight: 700, fontSize: 13 }}>✅ {aiMatches.length} jogos encontrados</span>
              <button
                onClick={() => { setMatches(aiMatches); setAiMatches(null); addToast(`✅ ${aiMatches.length} jogos da Copa salvos!`, "success"); }}
                style={{ background: "linear-gradient(90deg,#00bcd4,#0097a7)", border: "none", borderRadius: 8, color: "#fff", fontWeight: 800, fontSize: 13, padding: "7px 14px", cursor: "pointer" }}
              >
                💾 Salvar Todos
              </button>
            </div>
            <div style={{ maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
              {aiMatches.map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#90a4ae", background: "rgba(255,255,255,0.03)", borderRadius: 6, padding: "4px 8px" }}>
                  <span>{m.home} × {m.away}</span>
                  <span>{m.date} {m.time}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setAiMatches(null)} style={{ marginTop: 8, width: "100%", background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#546e7a", padding: "6px", fontSize: 12, cursor: "pointer" }}>
              Descartar
            </button>
          </div>
        )}

        <ScoreUpdatesPanel
          checkingUpdates={checkingUpdates}
          checkError={checkError}
          scoreUpdates={scoreUpdates}
          handleCheckUpdates={handleCheckUpdates}
          applyScoreUpdates={applyScoreUpdates}
        />

        <OfficialAwardsPanel officialAwards={officialAwards} setOfficialAwards={setOfficialAwards} matches={matches} addToast={addToast} />

        <BackupPanel allUsers={allUsers} matches={matches} predictions={predictions} awardPicks={awardPicks} officialAwards={officialAwards} setUsers={setUsers} setMatches={setMatches} setPredictions={setPredictions} setAwardPicks={setAwardPicks} setOfficialAwards={setOfficialAwards} addToast={addToast} />

        <AdminUsersPanel allNonAdminUsers={allNonAdminUsers} setUsers={setUsers} addToast={addToast} />

        <div style={styles.tabRow}>
          {phases.map(ph => (
            <button key={ph} onClick={() => setActivePhase(ph)} style={{ ...styles.tab, ...(activePhase===ph?styles.tabActive:{}) }}>
              {ph.replace(" de Final","").replace("Fase de ","")}
            </button>
          ))}
        </div>

        <p style={{ color: "#78909c", fontSize: 12, marginBottom: 10, marginTop: 12 }}>Registrar resultados dos jogos:</p>
        {filtered.map(m => (
          <div key={m.id} style={styles.adminMatchCard}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ color: "#78909c", fontSize: 11 }}>📅 {m.date} {m.time}</span>
              {m.homeScore !== null ? <span style={{ color: "#4caf50", fontSize: 11, fontWeight: 700 }}>✅ {m.homeScore}×{m.awayScore}</span> : <span style={{ color: "#546e7a", fontSize: 11 }}>Aguardando</span>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#cfd8dc", flex: 1, minWidth: 80 }}>{m.home}</span>
              <input type="number" min={0} max={30} value={adminScores[m.id]?.home ?? (m.homeScore !== null ? m.homeScore : "")} onChange={e => setAdminScores(p => ({ ...p, [m.id]: { ...p[m.id], home: e.target.value } }))} style={styles.scoreInputSm} placeholder="0" />
              <span style={{ color: "#546e7a" }}>×</span>
              <input type="number" min={0} max={30} value={adminScores[m.id]?.away ?? (m.awayScore !== null ? m.awayScore : "")} onChange={e => setAdminScores(p => ({ ...p, [m.id]: { ...p[m.id], away: e.target.value } }))} style={styles.scoreInputSm} placeholder="0" />
              <span style={{ fontSize: 12, fontWeight: 600, color: "#cfd8dc", flex: 1, minWidth: 80, textAlign: "right" }}>{m.away}</span>
              <button onClick={() => saveScore(m.id)} style={styles.btnSaveSmall}>Salvar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── TOP BAR ──────────────────────────────────────────────────────────────────
function TopBar({ title, onBack }) {
  return (
    <div style={styles.topBar}>
      <button onClick={onBack} style={styles.backBtn}>← Voltar</button>
      <span style={styles.topBarTitle}>{title}</span>
      <div style={{ width: 64 }} />
    </div>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = {
  root: { background: "#0a0e1a", minHeight: "100vh" },
  desktopShell: { display: "flex", minHeight: "100vh" },
  sidebar: { width: 268, flexShrink: 0, background: "linear-gradient(180deg,#0d2137 0%,#0a1628 100%)", borderRight: "1px solid rgba(255,255,255,0.08)", padding: "24px 18px", display: "flex", flexDirection: "column", justifyContent: "space-between", position: "sticky", top: 0, height: "100vh", overflowY: "auto" },
  sidebarBrand: { display: "flex", alignItems: "center", gap: 10, padding: "0 8px 18px", borderBottom: "1px solid rgba(255,255,255,0.08)", marginBottom: 16 },
  sidebarProfile: { display: "flex", alignItems: "center", gap: 10, width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "10px 12px", cursor: "pointer", textAlign: "left" },
  sidebarNavItem: { display: "flex", alignItems: "center", gap: 12, width: "100%", background: "none", border: "none", borderRadius: 10, padding: "11px 12px", color: "#90a4ae", fontSize: 13, fontWeight: 600, cursor: "pointer", textAlign: "left", transition: "background 0.15s" },
  sidebarNavItemActive: { background: "rgba(255,214,0,0.12)", color: "#ffd600" },
  sidebarLeaderCard: { background: "rgba(255,214,0,0.06)", border: "1px solid rgba(255,214,0,0.2)", borderRadius: 12, padding: "12px", marginBottom: 12 },
  sidebarLogout: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", background: "rgba(239,83,80,0.1)", border: "1px solid rgba(239,83,80,0.25)", borderRadius: 10, padding: "10px", color: "#ef5350", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  desktopMain: { flex: 1, minWidth: 0, display: "flex", justifyContent: "center", padding: "32px 24px" },
  authPageDesktop: { display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", maxWidth: "none" },
  authCard: { width: 420, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,0.4)" },
  page: { minHeight: "100vh", background: "linear-gradient(160deg,#0a0e1a 0%,#0d1b2a 60%,#0a1628 100%)", fontFamily: "'Segoe UI',system-ui,sans-serif", color: "#e0e0e0", maxWidth: 480, margin: "0 auto", paddingBottom: 40 },
  hero: { background: "linear-gradient(135deg,#0d2137 0%,#1a3a5c 50%,#0d2137 100%)", borderBottom: "3px solid #ffd600", padding: "28px 20px 20px", textAlign: "center" },
  trophyGlow: { fontSize: 52, lineHeight: 1, marginBottom: 8, filter: "drop-shadow(0 0 20px #ffd60066)" },
  heroTitle: { fontSize: 32, fontWeight: 900, margin: "0 0 4px", lineHeight: 1.1, letterSpacing: -1, color: "#fff" },
  heroSub: { color: "#78909c", fontSize: 13, margin: "0 0 0" },
  myStatsRow: { display: "flex", gap: 10, justifyContent: "center", marginTop: 16 },
  statBox: { background: "rgba(255,255,255,0.07)", borderRadius: 10, padding: "10px 18px", display: "flex", flexDirection: "column", alignItems: "center" },
  statNum: { fontSize: 22, fontWeight: 900, color: "#ffd600" },
  statLabel: { fontSize: 10, color: "#78909c", marginTop: 2 },
  nextMatchBadge: { background: "rgba(255,214,0,0.06)", border: "1px solid rgba(255,214,0,0.2)", borderRadius: 10, padding: "10px 14px", marginTop: 14, display: "flex", flexDirection: "column", gap: 2 },
  cardGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: "20px 16px 8px" },
  actionCard: { display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 12px", borderRadius: 14, border: "1px solid", cursor: "pointer", transition: "transform 0.15s", color: "#e0e0e0" },
  infoGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  infoCard: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "14px 12px", textAlign: "center" },
  infoCard2: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "12px", marginBottom: 12 },
  sectionTitle: { margin: "16px 0 10px", fontSize: 13, fontWeight: 700, color: "#90a4ae", letterSpacing: 0.5, textTransform: "uppercase" },
  rankRow: { display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" },
  topBar: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "rgba(0,0,0,0.5)", borderBottom: "1px solid rgba(255,255,255,0.08)", position: "sticky", top: 0, zIndex: 10, backdropFilter: "blur(10px)" },
  topBarTitle: { fontWeight: 700, fontSize: 14, color: "#e0e0e0", textAlign: "center", flex: 1 },
  backBtn: { background: "none", border: "none", color: "#00bcd4", cursor: "pointer", fontSize: 13, fontWeight: 600, padding: "4px 0", width: 64 },
  formBox: { padding: "24px 20px" },
  label: { display: "block", color: "#90a4ae", fontSize: 12, fontWeight: 600, marginBottom: 5, letterSpacing: 0.3 },
  input: { width: "100%", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, padding: "12px 14px", color: "#e0e0e0", fontSize: 15, marginBottom: 14, boxSizing: "border-box", outline: "none" },
  inputErr: { borderColor: "#ef5350" },
  errMsg: { color: "#ef5350", fontSize: 12, marginTop: -10, marginBottom: 10 },
  btn: { borderRadius: 10, padding: "12px 20px", fontWeight: 800, fontSize: 15, cursor: "pointer", border: "none", letterSpacing: 0.3 },
  btnFull: { width: "100%", display: "block", background: "#ffd600", color: "#0a0e1a" },
  linkBtn: { background: "none", border: "none", color: "#00bcd4", cursor: "pointer", fontWeight: 700, fontSize: 13, padding: 0 },
  usernameOk: { position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#4caf50", fontWeight: 700, fontSize: 16, marginTop: -7 },
  usernameErr: { position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#ef5350", fontWeight: 700, fontSize: 16, marginTop: -7 },
  multBadge: { background: "rgba(255,214,0,0.08)", border: "1px solid rgba(255,214,0,0.2)", borderRadius: 8, padding: "8px 16px", margin: "12px 16px 0", fontSize: 12, color: "#cfd8dc" },
  tabRow: { display: "flex", gap: 6, padding: "12px 16px 0", overflowX: "auto", scrollbarWidth: "none" },
  tab: { flexShrink: 0, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: "6px 14px", color: "#90a4ae", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" },
  tabActive: { background: "#ffd600", color: "#0a0e1a", fontWeight: 700, border: "1px solid #ffd600" },
  matchCard: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "12px", marginBottom: 10, marginTop: 12 },
  matchRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 },
  team: { flex: 1, fontSize: 12, fontWeight: 600, color: "#e0e0e0", textAlign: "center" },
  groupBadge: { background: "rgba(255,214,0,0.15)", color: "#ffd600", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10 },
  scoreInput: { width: 44, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, color: "#fff", fontSize: 18, fontWeight: 700, textAlign: "center", padding: "6px 2px", outline: "none" },
  scoreInputSm: { width: 38, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, color: "#fff", fontSize: 14, fontWeight: 700, textAlign: "center", padding: "4px 2px", outline: "none" },
  scoreBox: { background: "rgba(0,188,212,0.15)", border: "1px solid rgba(0,188,212,0.3)", borderRadius: 6, color: "#e0e0e0", fontSize: 18, fontWeight: 700, textAlign: "center", padding: "4px 10px" },
  bottomBar: { position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "rgba(10,14,26,0.95)", backdropFilter: "blur(10px)", padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.1)", zIndex: 20 },
  btnSave: { width: "100%", background: "linear-gradient(90deg,#00bcd4,#0097a7)", color: "#fff", border: "none", borderRadius: 12, padding: "14px", fontWeight: 800, fontSize: 15, cursor: "pointer" },
  btnSaveSmall: { background: "#00bcd4", color: "#fff", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" },
  rankCard: { display: "flex", alignItems: "center", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "14px", marginBottom: 10 },
  rankFirst: { background: "rgba(255,214,0,0.08)", border: "1px solid rgba(255,214,0,0.3)" },
  rankSecond: { background: "rgba(207,216,220,0.06)", border: "1px solid rgba(207,216,220,0.2)" },
  rankThird: { background: "rgba(255,152,0,0.06)", border: "1px solid rgba(255,152,0,0.2)" },
  adminMatchCard: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "12px", marginBottom: 10 },
};
