module.exports = {
  name: "cyber",
  version: "5.0.0",
  
  memory: {},

  // Typo tolerant fuzzy matcher for banglish casual words
  isMatch(input, keywords) {
    input = input.toLowerCase().replace(/[^a-z0-9অ-হঁংড়ঢ়য়েৈোৌ্\s]/g, '').trim();
    for (const kw of keywords) {
      // simple fuzzy check: all chars in order allowing up to 2 skips
      let i = 0, j = 0;
      while(i < input.length && j < kw.length) {
        if(input[i] === kw[j]) j++;
        i++;
      }
      if(j >= kw.length - 1) return true; // Allow 1 char skip in keyword
    }
    return false;
  },

  // Safe Math Eval with +,-,*,/,%,^ and parentheses
  calculate(expr) {
    try {
      if (!/^[0-9+\-*/%^().\s]+$/.test(expr)) return null;
      expr = expr.replace(/\^/g, '**');
      const result = Function(`"use strict"; return (${expr})`)();
      if (typeof result === "number" && !isNaN(result) && isFinite(result)) {
        return Math.round(result * 100000) / 100000;
      }
      return null;
    } catch {
      return null;
    }
  },

  // Emotion detect from keywords for fun replies
  detectEmotion(text) {
    const happy = ['khushi', 'happy', 'bhalo', 'mazar', 'mone bhalo', 'valo'];
    const sad = ['dukho', 'kosto', 'bore', 'tension', 'bujhte parchi na', 'ontor'];
    const angry = ['kosto', 'ragi', 'krodh', 'kosto', 'bokachoda', 'kichu bhalo lagche na'];
    const laugh = ['hashi', 'majadar', 'boshonto', 'funn', 'komedi', 'joke'];

    if (happy.some(w => text.includes(w))) return "happy";
    if (sad.some(w => text.includes(w))) return "sad";
    if (angry.some(w => text.includes(w))) return "angry";
    if (laugh.some(w => text.includes(w))) return "laugh";
    return null;
  },

  formatTime(date) {
    return date.toLocaleTimeString('bn-BD', { hour12: false });
  },

  formatDate(date) {
    return date.toLocaleDateString('bn-BD', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  },

  getGreeting() {
    return "👋 Assalamu Alaikum! Kemon aso? Ami *Cyber Bot*, tomar digital bondhu. Kichu jiggesh korle bolo, ami khushi hoye help korbo! 😊";
  },

  getThanksReply() {
    return "🙏 Apnakeo onek dhonnobad! Kichu lagle abar bolo, ami chesta korbo bhalo vabe sahajjo korte. 😄";
  },

  getJoke() {
    const jokes = [
      "😄 Ekta math problem: 2 + 2 = 5? Na, 4! 😂",
      "😂 Computer er friend ki? Byte! 😜",
      "🤣 Tomar math test kemon gelo? Ami je code likhi, test hoy na! 😅",
      "😆 Ami AI, tai ami kakhono tired hoyna, kintu tomar math problem dekhle amar head ache! 🤖",
    ];
    return jokes[Math.floor(Math.random() * jokes.length)];
  },

  getHelp() {
    return (
      "🛠️ Ami onek kichu korte pari:\n" +
      "- *time* / *somoy* => Akhon er somoy janate\n" +
      "- *date* / *tarikh* => Ajker tarikh bolte pari\n" +
      "- *math* question (jemon: 5 + 7 * 2) => calculation korte pari\n" +
      "- *hello*, *hi*, *kemon aso* => greeting dite pari\n" +
      "- *thanks*, *dhonnobad* => polite reply dite pari\n" +
      "- *joke*, *hashi* => moja-mojar joke dite pari\n" +
      "- Aar onek kichu, just bolo! 😎"
    );
  },

  // Memory save per user id with last topic and timestamp
  saveMemory(senderID, data) {
    this.memory[senderID] = {
      ...this.memory[senderID],
      ...data,
      lastActive: Date.now()
    };
  },

  // Clean old memory every 24 hours to prevent memory bloat
  cleanMemory() {
    const now = Date.now();
    for (const user in this.memory) {
      if (now - this.memory[user].lastActive > 86400000) { // 24 hours
        delete this.memory[user];
      }
    }
  },

  async handleMessage(event, apiSend) {
    try {
      this.cleanMemory();

      const senderID = event.sender.id;
      const rawText = event.message && event.message.text ? event.message.text.trim() : "";
      if (!rawText) return;

      const text = rawText.toLowerCase();

      if (!this.memory[senderID]) this.memory[senderID] = { lastTopic: null };

      // Detect emotion to personalize reply
      const emotion = this.detectEmotion(text);

      // Greeting keywords
      if (this.isMatch(text, ['hello', 'hi', 'helo', 'hii', 'hey', 'assalamu', 'salam', 'asa', 'kamon', 'kemon', 'ki', 'kemon aso', 'kamon aso', 'kemon accho'])) {
        this.saveMemory(senderID, { lastTopic: "greeting" });
        return await apiSend(senderID,
          (emotion === "happy" ? "😊 " : "") +
          this.getGreeting()
        );
      }

      // Thanks keywords
      if (this.isMatch(text, ['thanks', 'thank you', 'dhonnobad', 'shukriya', 'tanks', 'thnx'])) {
        this.saveMemory(senderID, { lastTopic: "thanks" });
        return await apiSend(senderID,
          (emotion === "happy" ? "🙏✨ " : "") +
          this.getThanksReply()
        );
      }

      // Help keywords
      if (text.includes("help") || text.includes("sahayota") || text.includes("command") || text.includes("kicchu bol") || text.includes("kichu bolo") || text.includes("help koro")) {
        this.saveMemory(senderID, { lastTopic: "help" });
        return await apiSend(senderID, this.getHelp());
      }

      // Time request
      if (text.includes("time") || text.includes("somoy") || text.includes("shomoy")) {
        this.saveMemory(senderID, { lastTopic: "time" });
        const now = new Date();
        return await apiSend(senderID, `🕰️ Akhon er somoy holo: ${this.formatTime(now)}`);
      }

      // Date request
      if (text.includes("date") || text.includes("tarikh") || text.includes("tarik")) {
        this.saveMemory(senderID, { lastTopic: "date" });
        const now = new Date();
        return await apiSend(senderID, `📅 Ajker tarikh holo: ${this.formatDate(now)}`);
      }

      // Math solve
      const mathResult = this.calculate(rawText);
      if (mathResult !== null) {
        this.saveMemory(senderID, { lastTopic: "math" });
        return await apiSend(senderID, `🧮 Math er uttor holo: ${mathResult}`);
      }

      // Joke request
      if (this.isMatch(text, ['joke', 'hashi', 'funny', 'mojar'])) {
        this.saveMemory(senderID, { lastTopic: "joke" });
        return await apiSend(senderID, this.getJoke());
      }

      // Context-aware follow up replies
      const lastTopic = this.memory[senderID].lastTopic;
      if (lastTopic === "greeting") {
        return await apiSend(senderID, "Aro kisu jante chaile 'help' bolio, ami tomake bhalo vabe assist korte parbo! 😊");
      }
      if (lastTopic === "thanks") {
        return await apiSend(senderID, "Ami to sahajjo korte chai! Kichu lagle janio. 🙌");
      }
      if (lastTopic === "help") {
        return await apiSend(senderID, "Kichu command try korar proyojon hole bolo. Ami ready achi! 🤖");
      }
      if (lastTopic === "math") {
        return await apiSend(senderID, "Aro math question thakle bolo, ami chesta korbo solve korte! 🧠");
      }
      if (lastTopic === "joke") {
        return await apiSend(senderID, "Ar ekta joke sunte chaile bolo! 😄");
      }

      // Default fallback reply
      return await apiSend(senderID,
        "😕 Sorry, ami bujhte pari nai. Apni 'help' bolen, ami kichu command bolbo.\n" +
        "Time, date, simple math solve korte pari. Try kore dekho! 🚀"
      );

    } catch (err) {
      console.error("Error in cyber.js handleMessage:", err);
    }
  }
};
