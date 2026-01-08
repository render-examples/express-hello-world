"use strict";

const PROMPTS = {
  step1_welcome_name: {
    main: "Benvenuto da TuttiBrilli! Come ti chiami?",
    short: "Come ti chiami?",
  },
  step2_confirm_name_ask_date: {
    main: "Piacere {{name}}. Per quale giorno vuoi prenotare?",
  },
  step3_confirm_date_ask_time: {
    main: "Perfetto, {{dateLabel}}. A che ora vuoi venire?",
    error: "Non ho capito la data. Puoi ripeterla, ad esempio 12 settembre?",
  },
  step4_confirm_time_ask_party_size: {
    error: "Non ho capito l'orario. Puoi ripeterlo?",
  },
  step5_party_size_ask_notes: {
    main: "Perfetto. Avete richieste particolari o intolleranze?",
    error: "Non ho capito quante persone siete. Puoi ripetere?",
  },
  step8_summary_confirm: {
    main: "Riepilogo: {{name}}, {{partySize}} persone, {{dateLabel}} alle {{time}}. Confermi?",
    short: "Confermi la prenotazione per {{partySize}} persone il {{dateLabel}} alle {{time}}?",
  },
  step9_success: {
    main: "Perfetto, la tua prenotazione è confermata. Ti aspettiamo!",
  },
  step9_fallback_transfer_operator: {
    main: "Ti passo un operatore per completare la richiesta.",
  },
};

module.exports = { PROMPTS };
