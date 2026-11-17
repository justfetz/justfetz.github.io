/* The Long Play — dataset
 * Eminem's twelve studio albums, standard editions.
 *
 * Sources (checked November 2026):
 *  - RIAA Gold & Platinum database (certification level per album)
 *  - Each album's Wikipedia article (release date, track listing, credited
 *    features, first-week U.S. figures as reported by Billboard / Luminate,
 *    Metacritic score, Grammy result)
 *  - Metacritic (The Death of Slim Shady score)
 *
 * Track tuple: [title, credited guests (array) or null, isSkitOrInterlude]
 * week.n     : best U.S. sales week used for the vertical position
 * week.kind  : "sales" = pure album sales, "units" = album-equivalent units
 * week.pure  : pure album sales inside a "units" week
 * week.debut : a shortened debut frame that preceded the first full week
 * riaa       : RIAA certification in millions of units (null = not certified)
 */
const EM_DATA = {
  asOf: "November 2026",
  albums: [
    {
      id: "infinite", title: "Infinite", date: "1996-11-12", label: "Web Entertainment",
      peak: null, week: null, riaa: null, metacritic: null, grammy: null,
      pressed: 1000,
      note: "About 1,000 copies pressed on cassette and vinyl. It never charted.",
      tracks: [
        ["Infinite", null, 0],
        ["W.E.G.O. (Interlude)", null, 1],
        ["It's O.K.", ["Eye-Kyu"], 0],
        ["Tonite", null, 0],
        ["313", ["Eye-Kyu"], 0],
        ["Maxine", ["Denaun Porter", "Three"], 0],
        ["Open Mic", ["Thyme"], 0],
        ["Never 2 Far", null, 0],
        ["Searchin'", ["Eye-Kyu", "Angela Workman"], 0],
        ["Backstabber", null, 0],
        ["Jealousy Woes II", null, 0]
      ]
    },
    {
      id: "sslp", title: "The Slim Shady LP", date: "1999-02-23", label: "Aftermath / Interscope",
      peak: 2, week: { n: 283000, kind: "sales" }, riaa: 5, metacritic: null,
      grammy: { won: true, year: 2000 },
      note: "Debuted at No. 2, behind TLC’s FanMail. His only major-label studio album that did not open at No. 1.",
      tracks: [
        ["Public Service Announcement", null, 1],
        ["My Name Is", null, 0],
        ["Guilty Conscience", ["Dr. Dre"], 0],
        ["Brain Damage", null, 0],
        ["Paul (skit)", null, 1],
        ["If I Had", null, 0],
        ["'97 Bonnie & Clyde", null, 0],
        ["Bitch (skit)", null, 1],
        ["Role Model", null, 0],
        ["Lounge (skit)", null, 1],
        ["My Fault", null, 0],
        ["Ken Kaniff (skit)", null, 1],
        ["Cum on Everybody", ["Dina Rae"], 0],
        ["Rock Bottom", null, 0],
        ["Just Don't Give a Fuck", null, 0],
        ["Soap (skit)", null, 1],
        ["As the World Turns", null, 0],
        ["I'm Shady", null, 0],
        ["Bad Meets Evil", ["Royce da 5'9\""], 0],
        ["Still Don't Give a Fuck", null, 0]
      ]
    },
    {
      id: "mmlp", title: "The Marshall Mathers LP", date: "2000-05-23", label: "Aftermath / Interscope",
      peak: 1, week: { n: 1760000, kind: "sales" }, riaa: 11, metacritic: 78,
      grammy: { won: true, year: 2001 },
      note: "1.76 million copies in its first week, more than double the previous rap record.",
      tracks: [
        ["Public Service Announcement 2000", null, 1],
        ["Kill You", null, 0],
        ["Stan", ["Dido"], 0],
        ["Paul (skit)", null, 1],
        ["Who Knew", null, 0],
        ["Steve Berman (skit)", null, 1],
        ["The Way I Am", null, 0],
        ["The Real Slim Shady", null, 0],
        ["Remember Me?", ["RBX", "Sticky Fingaz"], 0],
        ["I'm Back", null, 0],
        ["Marshall Mathers", null, 0],
        ["Ken Kaniff (skit)", null, 1],
        ["Drug Ballad", null, 0],
        ["Amityville", ["Bizarre"], 0],
        ["Bitch Please II", ["Dr. Dre", "Snoop Dogg", "Xzibit", "Nate Dogg"], 0],
        ["Kim", null, 0],
        ["Under the Influence", ["D12"], 0],
        ["Criminal", null, 0]
      ]
    },
    {
      id: "tes", title: "The Eminem Show", date: "2002-05-26", label: "Shady / Aftermath / Interscope",
      peak: 1, week: { n: 1322000, kind: "sales", debut: 284000 }, riaa: 12, metacritic: 75,
      grammy: { won: true, year: 2003 },
      note: "Rushed out early after it leaked: about 284,000 copies in a cut-short debut frame, then 1.32 million in its first full week.",
      tracks: [
        ["Curtains Up (skit)", null, 1],
        ["White America", null, 0],
        ["Business", null, 0],
        ["Cleanin' Out My Closet", null, 0],
        ["Square Dance", null, 0],
        ["The Kiss (skit)", null, 1],
        ["Soldier", null, 0],
        ["Say Goodbye Hollywood", null, 0],
        ["Drips", ["Obie Trice"], 0],
        ["Without Me", null, 0],
        ["Paul Rosenberg (skit)", null, 1],
        ["Sing for the Moment", null, 0],
        ["Superman", ["Dina Rae"], 0],
        ["Hailie's Song", null, 0],
        ["Steve Berman (skit)", null, 1],
        ["When the Music Stops", ["D12"], 0],
        ["Say What You Say", ["Dr. Dre"], 0],
        ["'Till I Collapse", ["Nate Dogg"], 0],
        ["My Dad's Gone Crazy", ["Hailie Jade"], 0],
        ["Curtains Close (skit)", null, 1]
      ]
    },
    {
      id: "encore", title: "Encore", date: "2004-11-12", label: "Shady / Aftermath / Interscope",
      peak: 1, week: { n: 871000, kind: "sales", debut: 710000 }, riaa: 5, metacritic: 64,
      grammy: { won: false, year: 2006 },
      note: "Moved up to beat a leak: 710,000 copies in a three-day debut frame, then 871,000 in its first full week.",
      tracks: [
        ["Curtains Up", null, 1],
        ["Evil Deeds", null, 0],
        ["Never Enough", ["50 Cent", "Nate Dogg"], 0],
        ["Yellow Brick Road", null, 0],
        ["Like Toy Soldiers", null, 0],
        ["Mosh", null, 0],
        ["Puke", null, 0],
        ["My 1st Single", null, 0],
        ["Paul (skit)", null, 1],
        ["Rain Man", null, 0],
        ["Big Weenie", null, 0],
        ["Em Calls Paul (skit)", null, 1],
        ["Just Lose It", null, 0],
        ["Ass Like That", null, 0],
        ["Spend Some Time", ["Obie Trice", "Stat Quo", "50 Cent"], 0],
        ["Mockingbird", null, 0],
        ["Crazy in Love", null, 0],
        ["One Shot 2 Shot", ["D12"], 0],
        ["Final Thought (skit)", null, 1],
        ["Encore / Curtains Down", ["Dr. Dre", "50 Cent"], 0]
      ]
    },
    {
      id: "relapse", title: "Relapse", date: "2009-05-19", label: "Shady / Aftermath / Interscope",
      peak: 1, week: { n: 608000, kind: "sales" }, riaa: 3, metacritic: 59,
      grammy: { won: true, year: 2010 },
      note: "His first studio album in four and a half years.",
      tracks: [
        ["Dr. West (skit)", null, 1],
        ["3 a.m.", null, 0],
        ["My Mom", null, 0],
        ["Insane", null, 0],
        ["Bagpipes from Baghdad", null, 0],
        ["Hello", null, 0],
        ["Tonya (skit)", null, 1],
        ["Same Song & Dance", null, 0],
        ["We Made You", null, 0],
        ["Medicine Ball", null, 0],
        ["Paul (skit)", null, 1],
        ["Stay Wide Awake", null, 0],
        ["Old Time's Sake", ["Dr. Dre"], 0],
        ["Must Be the Ganja", null, 0],
        ["Mr. Mathers (skit)", null, 1],
        ["Déjà Vu", null, 0],
        ["Beautiful", null, 0],
        ["Crack a Bottle", ["Dr. Dre", "50 Cent"], 0],
        ["Steve Berman (skit)", null, 1],
        ["Underground", null, 0]
      ]
    },
    {
      id: "recovery", title: "Recovery", date: "2010-06-21", label: "Shady / Aftermath / Interscope",
      peak: 1, week: { n: 741000, kind: "sales" }, riaa: 8, metacritic: 63,
      grammy: { won: true, year: 2011 },
      note: "The best-selling album of 2010 worldwide. It has no skits.",
      tracks: [
        ["Cold Wind Blows", null, 0],
        ["Talkin' 2 Myself", ["Kobe"], 0],
        ["On Fire", null, 0],
        ["Won't Back Down", ["P!nk"], 0],
        ["W.T.P.", null, 0],
        ["Going Through Changes", null, 0],
        ["Not Afraid", null, 0],
        ["Seduction", null, 0],
        ["No Love", ["Lil Wayne"], 0],
        ["Space Bound", null, 0],
        ["Cinderella Man", null, 0],
        ["25 to Life", null, 0],
        ["So Bad", null, 0],
        ["Almost Famous", null, 0],
        ["Love the Way You Lie", ["Rihanna"], 0],
        ["You're Never Over", null, 0],
        ["Untitled (hidden track)", null, 0]
      ]
    },
    {
      id: "mmlp2", title: "The Marshall Mathers LP 2", date: "2013-11-05", label: "Shady / Aftermath / Interscope",
      peak: 1, week: { n: 792000, kind: "sales" }, riaa: 4, metacritic: 72,
      grammy: { won: true, year: 2015 },
      note: "His sixth Grammy for Best Rap Album, a record for the category.",
      tracks: [
        ["Bad Guy", null, 0],
        ["Parking Lot (skit)", null, 1],
        ["Rhyme or Reason", null, 0],
        ["So Much Better", null, 0],
        ["Survival", null, 0],
        ["Legacy", null, 0],
        ["Asshole", ["Skylar Grey"], 0],
        ["Berzerk", null, 0],
        ["Rap God", null, 0],
        ["Brainless", null, 0],
        ["Stronger Than I Was", null, 0],
        ["The Monster", ["Rihanna"], 0],
        ["So Far...", null, 0],
        ["Love Game", ["Kendrick Lamar"], 0],
        ["Headlights", ["Nate Ruess"], 0],
        ["Evil Twin", null, 0]
      ]
    },
    {
      id: "revival", title: "Revival", date: "2017-12-15", label: "Shady / Aftermath / Interscope",
      peak: 1, week: { n: 267000, kind: "units", pure: 197000 }, riaa: 1, metacritic: 50,
      grammy: null,
      note: "267,000 album-equivalent units in week one, 197,000 of them pure album sales.",
      tracks: [
        ["Walk on Water", ["Beyoncé"], 0],
        ["Believe", null, 0],
        ["Chloraseptic", ["Phresher"], 0],
        ["Untouchable", null, 0],
        ["River", ["Ed Sheeran"], 0],
        ["Remind Me (Intro)", null, 1],
        ["Remind Me", null, 0],
        ["Revival (Interlude)", null, 1],
        ["Like Home", ["Alicia Keys"], 0],
        ["Bad Husband", ["X Ambassadors"], 0],
        ["Tragic Endings", ["Skylar Grey"], 0],
        ["Framed", null, 0],
        ["Nowhere Fast", ["Kehlani"], 0],
        ["Heat", null, 0],
        ["Offended", null, 0],
        ["Need Me", ["P!nk"], 0],
        ["In Your Head", null, 0],
        ["Castle", null, 0],
        ["Arose", null, 0]
      ]
    },
    {
      id: "kamikaze", title: "Kamikaze", date: "2018-08-31", label: "Shady / Aftermath / Interscope",
      peak: 1, week: { n: 434000, kind: "units", pure: 252000 }, riaa: 1, metacritic: 62,
      grammy: null,
      note: "A surprise release: 434,000 units in week one, 252,000 of them pure album sales.",
      tracks: [
        ["The Ringer", null, 0],
        ["Greatest", null, 0],
        ["Lucky You", ["Joyner Lucas"], 0],
        ["Paul (skit)", null, 1],
        ["Normal", null, 0],
        ["Em Calls Paul (skit)", null, 1],
        ["Stepping Stone", null, 0],
        ["Not Alike", ["Royce da 5'9\""], 0],
        ["Kamikaze", null, 0],
        ["Fall", null, 0],
        ["Nice Guy", ["Jessie Reyez"], 0],
        ["Good Guy", ["Jessie Reyez"], 0],
        ["Venom", null, 0]
      ]
    },
    {
      id: "mtbmb", title: "Music to Be Murdered By", date: "2020-01-17", label: "Shady / Aftermath / Interscope",
      peak: 1, week: { n: 279000, kind: "units", pure: 117000 }, riaa: 1, metacritic: 64,
      grammy: null,
      note: "His tenth album in a row to debut at No. 1, a Billboard 200 first.",
      tracks: [
        ["Premonition (Intro)", null, 0],
        ["Unaccommodating", ["Young M.A"], 0],
        ["You Gon' Learn", ["Royce da 5'9\"", "White Gold"], 0],
        ["Alfred (Interlude)", null, 1],
        ["Those Kinda Nights", ["Ed Sheeran"], 0],
        ["In Too Deep", null, 0],
        ["Godzilla", ["Juice WRLD"], 0],
        ["Darkness", null, 0],
        ["Leaving Heaven", ["Skylar Grey"], 0],
        ["Yah Yah", ["Royce da 5'9\"", "Black Thought", "Q-Tip", "Denaun Porter"], 0],
        ["Stepdad (Intro)", null, 1],
        ["Stepdad", null, 0],
        ["Marsh", null, 0],
        ["Never Love Again", null, 0],
        ["Little Engine", null, 0],
        ["Lock It Up", ["Anderson .Paak"], 0],
        ["Farewell", null, 0],
        ["No Regrets", ["Don Toliver"], 0],
        ["I Will", ["KXNG Crooked", "Royce da 5'9\"", "Joell Ortiz"], 0],
        ["Alfred (Outro)", null, 1]
      ]
    },
    {
      id: "tdoss", title: "The Death of Slim Shady (Coup de Grâce)", short: "The Death of Slim Shady",
      date: "2024-07-12", label: "Shady / Aftermath / Interscope",
      peak: 1, week: { n: 281000, kind: "units", pure: 114000 }, riaa: null, metacritic: 46,
      grammy: { won: false, year: 2025 },
      note: "His eleventh No. 1 album. Not yet certified by the RIAA, though trade reports put it near a million U.S. units by the end of 2024.",
      tracks: [
        ["Renaissance", null, 0],
        ["Habits", ["White Gold"], 0],
        ["Trouble", null, 0],
        ["Brand New Dance", null, 0],
        ["Evil", null, 0],
        ["All You Got (skit)", null, 1],
        ["Lucifer", ["Sly Pyper"], 0],
        ["Antichrist", null, 0],
        ["Fuel", ["JID"], 0],
        ["Road Rage", ["Dem Jointz", "Sly Pyper"], 0],
        ["Houdini", null, 0],
        ["Breaking News (skit)", null, 1],
        ["Guilty Conscience 2", null, 0],
        ["Head Honcho", ["Ez Mil"], 0],
        ["Temporary", ["Skylar Grey"], 0],
        ["Bad One", ["White Gold"], 0],
        ["Tobey", ["Big Sean", "BabyTron"], 0],
        ["Guess Who's Back (skit)", null, 1],
        ["Somebody Save Me", ["Jelly Roll"], 0]
      ]
    }
  ],

  /* Shown as a ghost record for context; not part of the studio-album counts. */
  compilation: {
    id: "curtaincall", title: "Curtain Call: The Hits", date: "2005-12-06",
    peak: 1, week: { n: 441000, kind: "sales" }, riaa: 10,
    note: "A greatest-hits set, certified Diamond in 2022. It is the longest-charting rap album in Billboard 200 history, and in September 2024 became the first to reach 700 weeks."
  },

  /* What the frequent collaborators did with him away from these twelve albums. */
  beyond: {
    "Dr. Dre": "Signed him to Aftermath in 1998 and has an executive-producer credit on most of the albums since.",
    "Royce da 5'9\"": "The other half of Bad Meets Evil; their 2011 EP Hell: The Sequel topped the Billboard 200.",
    "D12": "His Detroit group. Devil's Night (2001) and D12 World (2004) both reached No. 1.",
    "50 Cent": "Signed jointly to Shady and Aftermath in 2002.",
    "Rihanna": "Four duets in all, including “Love the Way You Lie (Part II)” and “Numb” on her own albums.",
    "Skylar Grey": "Co-wrote “Love the Way You Lie” before she ever appeared on one of his albums.",
    "Denaun Porter": "Also known as Mr. Porter and Kon Artis of D12; a producer on many of the albums.",
    "Bizarre": "A member of D12."
  }
};

if (typeof module !== "undefined") module.exports = EM_DATA;
