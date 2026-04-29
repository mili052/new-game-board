(() => {
  const PASSWORD = "mimi2026";
  const STORAGE_KEY = "ngb-public-access";
  const normalize = value => String(value || "").trim();

  const form = document.getElementById("publicGateForm");
  const input = document.getElementById("publicGateInput");
  const message = document.getElementById("publicGateMessage");

  if (!form || !input || !message) return;

  let toggle = document.getElementById("publicGateToggle");
  if (!toggle) {
    const field = document.createElement("div");
    field.className = "password-field";
    input.parentNode.insertBefore(field, input);
    field.appendChild(input);

    toggle = document.createElement("button");
    toggle.id = "publicGateToggle";
    toggle.className = "password-toggle";
    toggle.type = "button";
    toggle.setAttribute("aria-label", "\u663e\u793a\u5bc6\u7801");
    toggle.textContent = "\uD83D\uDC41";
    field.appendChild(toggle);
  }

  let remember = document.getElementById("publicGateRemember");
  if (!remember) {
    const rememberLabel = document.createElement("label");
    rememberLabel.className = "remember-check";

    remember = document.createElement("input");
    remember.id = "publicGateRemember";
    remember.type = "checkbox";
    remember.checked = true;

    const text = document.createElement("span");
    text.textContent = "\u8bb0\u4f4f\u672c\u673a";

    rememberLabel.appendChild(remember);
    rememberLabel.appendChild(text);
    form.insertBefore(rememberLabel, form.querySelector(".primary"));
  }

  if (localStorage.getItem(STORAGE_KEY) === PASSWORD) {
    remember.checked = true;
  }

  toggle.addEventListener("click", () => {
    const nextType = input.type === "password" ? "text" : "password";
    input.type = nextType;
    toggle.textContent = nextType === "password" ? "\uD83D\uDC41" : "\uD83D\uDE48";
    toggle.setAttribute(
      "aria-label",
      nextType === "password" ? "\u663e\u793a\u5bc6\u7801" : "\u9690\u85cf\u5bc6\u7801"
    );
    input.focus();
  });

  form.addEventListener(
    "submit",
    event => {
      event.preventDefault();
      event.stopImmediatePropagation();

      if (normalize(input.value) !== PASSWORD) {
        message.textContent = "\u5bc6\u7801\u4e0d\u5bf9\uff0c\u518d\u8bd5\u4e00\u4e0b\u3002";
        input.select();
        return;
      }

      if (remember.checked) {
        localStorage.setItem(STORAGE_KEY, PASSWORD);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }

      message.textContent = "";
      window.location.reload();
    },
    true
  );
})();
