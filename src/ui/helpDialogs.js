// The ? keys: a button with data-help="<dialog id>" opens that popup; a click on the backdrop closes it.
// (Inside a <summary> the click would also fold the section, so it is stopped.)
export function bindHelpDialogs() {
  document.addEventListener('click', e => {
    const k = e.target.closest('[data-help]');
    if (k) {
      const d = document.getElementById(k.dataset.help);
      if (d) { e.preventDefault(); e.stopPropagation(); if (!d.open) d.showModal ? d.showModal() : d.setAttribute('open', ''); }
    } else if (e.target.matches && e.target.matches('dialog.keys-help')) e.target.close();
  });
}
