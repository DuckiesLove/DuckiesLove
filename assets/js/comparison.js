(() => {
  const $ = (s, r = document) => r.querySelector(s);

  let aData = null;
  let bData = null;

  const fileA = $('#fileA');
  const fileB = $('#fileB');
  const chipA = $('#chipA');
  const chipB = $('#chipB');
  const btnExport = $('#btnExport');
  const drop = $('#dropzone');

  function setChip(chip, file) {
    chip.textContent = file.name;
    chip.hidden = false;
  }
  function enableIfReady() {
    btnExport.disabled = !(aData && bData);
  }

  fileA?.addEventListener('change', async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    aData = await f
      .text()
      .then(JSON.parse)
      .catch(() => null);
    setChip(chipA, f);
    enableIfReady();
  });
  fileB?.addEventListener('change', async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    bData = await f
      .text()
      .then(JSON.parse)
      .catch(() => null);
    setChip(chipB, f);
    enableIfReady();
  });

  ['dragenter', 'dragover'].forEach((ev) =>
    drop?.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.classList.add('is-drag');
    })
  );
  ['dragleave', 'drop'].forEach((ev) =>
    drop?.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.classList.remove('is-drag');
    })
  );
  drop?.addEventListener('drop', async (e) => {
    const files = [...(e.dataTransfer?.files || [])]
      .filter((f) => /\.json$/i.test(f.name))
      .slice(0, 2);
    if (files[0]) {
      aData = await files[0]
        .text()
        .then(JSON.parse)
        .catch(() => null);
      setChip(chipA, files[0]);
    }
    if (files[1]) {
      bData = await files[1]
        .text()
        .then(JSON.parse)
        .catch(() => null);
      setChip(chipB, files[1]);
    }
    enableIfReady();
  });

  btnExport?.addEventListener('click', () => {
    if (!(aData && bData)) return;
    if (typeof window.downloadCompatibilityPDF === 'function') {
      try {
        window.downloadCompatibilityPDF({ surveyA: aData, surveyB: bData });
      } catch (err) {
        console.error('downloadCompatibilityPDF failed', err);
      }
    } else {
      console.warn('downloadCompatibilityPDF is not available');
    }
  });
})();
