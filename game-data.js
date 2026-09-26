// ============================================================
//  Everything you might want to edit lives in this file.
// ============================================================

module.exports = {
  SHOW_TITLE: "Dancing with the Stars",
  SUBTITLE: "Lauren's Bachelorette Edition",

  // Prize (the QR image itself goes in /prize/prize.png — see README)
  PRIZE_TEXT: "a $15 Common Good gift card",

  // Contestants and their AI-cast celebrity partners.
  // `bride: true` marks who the optional "Bride Clause" protects.
  COUPLES: [
    { name: "Haven",   celeb: "Timothée Chalamet",    short: "Timothée", img: "timothee", why: "He looks like he wandered out of a period drama. So does she." },
    { name: "Tori",    celeb: "Justin Bieber",        short: "Justin",   img: "justin",   why: "Bieber fever finally gets treated. Bodhi still gets the song.",
      // Right after her reveal, an "emergency message" swaps her partner for the rest of the game
      swap: {
        celeb: "Donald Trump", short: "Donald", img: "trump",
        why: "He appointed himself. Nobody could stop him.",
        message: "Wow.. Tori... I was shocked and saddened that I wasn't your celebrity partner... I would be the best dancer quite frankly... everyone knows that if I were your partner we would win... we would dance so well you wouldn't believe... many are saying I'm a great dancer... they are saying I'm the best dancer... ever in the world... and so I am replacing Justin as your partner. THANK YOU FOR YOUR ATTENTION TO THIS MATTER",
      } },
    { name: "Clare",   celeb: "Jonathan Bailey",      short: "Jonathan", img: "jonathan", why: "Tall, charming, and, most importantly, his name starts with J." },
    { name: "Jane",    celeb: "Jason Statham",        short: "Jason",    img: "jason",    why: "The only man who could survive rehearsal with her." },
    { name: "Stef",    celeb: "Pete Davidson",        short: "Pete",     img: "pete",     why: "Finally, a partner who won't notice if she doesn't show up." },
    { name: "Cara",    celeb: "Jeff Goldblum",        short: "Jeff",     img: "jeff",     why: "A fellow fashion icon who's definitely met the cicadas." },
    { name: "Abbyann", celeb: "Terry Crews",          short: "Terry",    img: "terry",    why: "The only partner she can't overhead-press. Probably." },
    { name: "Gillian", celeb: "Harry Styles",         short: "Harry",    img: "harry",    why: "A real British accent, so hers has something to copy." },
    { name: "Haley",   celeb: "Hugh Jackman",         short: "Hugh",     img: "hugh",     why: "Every marriage of theater kids needs a third. Ben has concerns." },
    { name: "Lauren",  celeb: "Aaron Taylor-Johnson", short: "Aaron",    img: "aaron",    why: "She always goes back to Aaron. So we found her a new one.", bride: true },
  ],

  DANCES: [
    "Cha-cha", "Argentine tango", "Viennese waltz", "Foxtrot", "Quickstep", "Paso doble",
    "Rumba", "Samba", "Jive", "Salsa", "Charleston", "Mambo", "Lambada", "Contemporary",
    "Hip-hop", "Burlesque", "Disco", "Interpretive dance", "Irish step dance", "Line dance",
    "Bollywood", "Lindy hop", "Lap-dance-adjacent rumba", "Dramatic lift-heavy waltz",
  ],

  SONGS: [
    ["My Neck, My Back (Lick It)", "Khia"],
    ["Baby Got Back", "Sir Mix-a-Lot"],
    ["It's Raining Men", "The Weather Girls"],
    ["Pony", "Ginuwine"],
    ["Milkshake", "Kelis"],
    ["I'm Too Sexy", "Right Said Fred"],
    ["Sexy and I Know It", "LMFAO"],
    ["Barbie Girl", "Aqua"],
    ["Macarena", "Los del Río"],
    ["Cotton Eye Joe", "Rednex"],
    ["Mambo No. 5", "Lou Bega"],
    ["Ice Ice Baby", "Vanilla Ice"],
    ["Man! I Feel Like a Woman!", "Shania Twain"],
    ["Before He Cheats", "Carrie Underwood"],
    ["Single Ladies (Put a Ring on It)", "Beyoncé"],
    ["Toxic", "Britney Spears"],
    ["Oops!... I Did It Again", "Britney Spears"],
    ["Bye Bye Bye", "*NSYNC"],
    ["I Want It That Way", "Backstreet Boys"],
    ["Wannabe", "Spice Girls"],
    ["Hot in Herre", "Nelly"],
    ["Get Low", "Lil Jon & The East Side Boyz"],
    ["Thong Song", "Sisqó"],
    ["Pour Some Sugar on Me", "Def Leppard"],
    ["Careless Whisper", "George Michael"],
    ["Let's Get It On", "Marvin Gaye"],
    ["Total Eclipse of the Heart", "Bonnie Tyler"],
    ["My Heart Will Go On", "Celine Dion"],
    ["I Will Survive", "Gloria Gaynor"],
    ["Hips Don't Lie", "Shakira"],
    ["Livin' la Vida Loca", "Ricky Martin"],
    ["The Final Countdown", "Europe"],
    ["Eye of the Tiger", "Survivor"],
    ["Cha Cha Slide", "DJ Casper"],
    ["Dancing Queen", "ABBA"],
    ["Mr. Brightside", "The Killers"],
    ["Party in the U.S.A.", "Miley Cyrus"],
    ["Low", "Flo Rida feat. T-Pain"],
    ["Whip It", "Devo"],
    ["Gasolina", "Daddy Yankee"],
  ],

  // Written for anyone on the chopping block who doesn't submit before the timer runs out.
  // {name} = the contestant, {celeb} = her celebrity partner's first name.
  AUTOFILL_ROUTINES: [
    "{name} forgot the choreography, so she mouthed the words and pointed at the judges for 90 seconds.",
    "{name} spent the whole routine looking for her other shoe. {celeb} did a solo out of pity.",
    "{name} did the Macarena. Wrong song. Wrong dance. Wrong everything. Twice.",
    "{name}'s routine was one very slow, very confident walk across the stage. Then she tripped.",
    "{name} got stage fright, hid behind {celeb}, and let him do jazz hands for both of them.",
    "{name} submitted a blank page and a dream. The dream was also blank.",
    "{name} texted her ex mid-routine. The judges saw. We all saw.",
    "{name} did the sprinkler, the shopping cart, and the lawnmower. In that order. For the whole song.",
  ],

  // Prompt shown to the two contestants on the chopping block (one picked per round)
  PROMPTS: [
    "Describe the vibe and energy of your performance.",
    "Sell it to the judges: what's the big moment of your routine?",
    "Describe your entrance, your costume, and your finale.",
    "What happens during your performance that nobody will forget?",
  ],

  // Parody judge comments shown when a couple is eliminated
  JUDGE_QUIPS: {
    "Carrie Ann": [
      "I loved the energy. I did not love anything else.",
      "The vision was there. The feet were somewhere else.",
      "Gorgeous. Chaotic. Mostly chaotic.",
      "I've never been so confused and so entertained.",
      "You committed. I just wish it was to the choreography.",
    ],
    "Derek": [
      "You hit every count. Just not in order.",
      "Technically that was a dance. Technically.",
      "Your frame was strong. Your choices were stronger. Neither was good.",
      "I'd like to see that again... in rehearsal. Privately.",
      "The confidence? Ten. Everything else? We'll talk.",
    ],
    "Bruno": [
      "Darling, it was a hurricane in heels!",
      "You were a disco ball in a blender!",
      "A catastrophe! A GLORIOUS catastrophe!",
      "You danced like the rent was due!",
      "It was like a wildlife documentary, darling. Beautiful and terrifying!",
    ],
  },
};
