const schemaUrl = browser.runtime.getURL("pdfjs/preferences_schema.json");

fetch(schemaUrl).then(resp => resp.json()).then(render);
document.forms[0].addEventListener("change", updatePref);
document.querySelector("legend input").onchange = toggleAdvanced;

function toggleAdvanced(e) {
  document.querySelector("fieldset").disabled = !e.target.checked;
  e.stopPropagation();
}

const frame = document.querySelector("iframe");
const frameLoad = new Promise(resolve => frame.onload = resolve);

function render(schema) {
  const prefs = schema.properties;

  for (let key in prefs) {
    const pref = prefs[key];
    const desc = pref.description;
    if (desc?.startsWith("DEPRECATED") || key === "disableTelemetry")
      continue;

    const template = document.querySelector("template");
    const prefRow = template.content.cloneNode(true);
    const label = prefRow.querySelector("span");
    label.textContent = pref.title || key;
    if (desc) {
      const span = prefRow.querySelector(".pref-desc");
      span.textContent = desc.split("\n", 1)[0];
    }

    const field = renderField(key, pref);
    const cont = prefRow.querySelector(".pref-field");
    cont.prepend(field);
    cont.lastElementChild.htmlFor = key;
    readPref(key, field, pref.default).then(() => {
      const advanced = document.forms[0].lastElementChild;
      if (pref.title)
        advanced.before(prefRow);
      else
        advanced.appendChild(prefRow);
    });
  }
}

function renderField(key, pref) {
  const renderFunc = pref.enum ? renderSelect : renderInput;
  const field = renderFunc(key, pref);
  field.id = key;
  field.dataset.type = pref.type;
  return field;
}

function renderInput(key, pref) {
  const input = document.createElement("input", key);
  if (pref.type === "boolean") {
    input.type = "checkbox";
  } else {
    input.type = (pref.type === "integer") ? "number" : "text";
    if (pref.pattern)
      input.pattern = pref.pattern;
  }
  return input;
}

function renderSelect(key, pref) {
  const select = document.createElement("select");
  const {type, enum: num, description} = pref;

  if (description) {
    let [_, ...options] = description.split("\n");
    const pairUp = opt => opt.split("=", 2).map(e => e.trim());
    options = Object.fromEntries(options.map(pairUp));

    for (let val of num) {
      const entry = options[val].split(/[(.]/, 1)[0];
      select.appendChild(new Option(entry, val));
    }
  } else {
    num.forEach(val => select.appendChild(new Option(val)));
  }
  return select;
}

function updatePref(evt) {
  const tgt = evt.target;
  if (!tgt.checkValidity()) {
    return;
  }
  let value = (tgt.type === "checkbox") ? tgt.checked : tgt.value;
  if (tgt.dataset.type === "integer") {
    value = Number(value);
  }
  const app = window.frames[0].PDFViewerApplication;
  app.preferences.set(tgt.id, value);
}

async function readPref(key, tgt, defaultPref) {
  await frameLoad;
  const app = window.frames[0].PDFViewerApplication;
  const pref = await app.preferences.get(key);

  const attr = (tgt.type === "checkbox") ? "checked" : "value";
  tgt[attr] = pref ?? defaultPref;
}
