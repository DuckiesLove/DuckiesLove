window.TKCompatPDF = {
  generateFromStorage: async function () {
    const [selfRaw, partnerRaw] = [
      localStorage.getItem("talkkink:compatSelf"),
      localStorage.getItem("talkkink:compatPartner"),
    ];
    if (!selfRaw || !partnerRaw) {
      alert("Both surveys must be loaded.");
      return;
    }
    const self = JSON.parse(selfRaw);
    const partner = JSON.parse(partnerRaw);
    const { generateCompatibilityPDF } = await import("./compatPdfCore.js");
    generateCompatibilityPDF(self, partner);
  }
};
