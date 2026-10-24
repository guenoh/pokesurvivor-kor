/* Registration rules for this independent server. Upstream account UI stays intact. */
(() => {
  const normalizeName = name => name.trim().normalize('NFKC');
  function validate(name, password, confirmation, register = true) {
    const normalized = normalizeName(name);
    if (!normalized) return { field: 'f-user', message: '이름을 입력해 주세요.' };
    if (!/^[\p{L}\p{N}_]{3,16}$/u.test(normalized)) return { field: 'f-user', message: '이름은 문자·숫자·밑줄(_)로 3~16자 입력해 주세요. 공백과 다른 특수문자는 사용할 수 없습니다.' };
    if (!password) return { field: 'f-pass', message: '비밀번호를 입력해 주세요.' };
    if (password.length < 4 || password.length > 128) return { field: 'f-pass', message: '비밀번호는 4~128자로 입력해 주세요.' };
    if (register && !confirmation) return { field: 'f-pass-confirm', message: '비밀번호를 한 번 더 입력해 주세요.' };
    if (register && password !== confirmation) return { field: 'f-pass-confirm', message: '비밀번호가 일치하지 않습니다. 다시 확인해 주세요.' };
    return null;
  }
  G.KorSignup = { validate, normalizeName };
  const init = G.LoginUI.init;
  G.LoginUI.init = function () {
    init.call(this);
    const form = document.getElementById('login-form');
    if (!form || document.getElementById('f-pass-confirm')) return;
    const username = document.getElementById('f-user'), password = document.getElementById('f-pass');
    const error = document.getElementById('login-err');
    const tabs = [...document.querySelectorAll('#scr-login .tab')];
    const isRegister = () => tabs.some(tab => tab.dataset.tab === 'register' && tab.classList.contains('on'));
    const make = (tag, id, className, text) => {
      const element = document.createElement(tag);
      element.id = id; element.className = className; element.setAttribute('translate', 'no');
      if (text) element.textContent = text;
      return element;
    };
    const nameHelp = make('p', 'f-user-help', 'kor-auth-help', '한글·영문 등 문자, 숫자, 밑줄(_)로 3~16자 입력해 주세요. 공백과 다른 특수문자는 사용할 수 없으며, 영문 대소문자는 구분하지 않습니다.');
    const passwordHelp = make('p', 'f-pass-help', 'kor-auth-help', '4~128자로 입력해 주세요. 한글·영문·숫자·특수문자 등을 사용할 수 있으며, 문자 종류를 반드시 섞을 필요는 없습니다.');
    username.after(nameHelp); password.after(passwordHelp);
    username.autocomplete = 'username'; username.autocapitalize = 'none';
    username.setAttribute('aria-describedby', nameHelp.id);
    password.setAttribute('aria-describedby', passwordHelp.id);
    error.setAttribute('role', 'alert');
    // Avoid browser-language validation bubbles; show the exact server rules in Korean.
    form.noValidate = true;
    const group = make('div', 'kor-password-confirm', 'kor-password-confirm');
    const label = make('label', 'f-pass-confirm-label', '', '비밀번호 확인');
    label.htmlFor = 'f-pass-confirm';
    const confirmation = make('input', 'f-pass-confirm', 'field');
    confirmation.type = 'password'; confirmation.maxLength = 128;
    confirmation.autocomplete = 'new-password';
    const status = make('p', 'f-pass-confirm-status', 'kor-auth-help kor-auth-status');
    status.setAttribute('aria-live', 'polite');
    confirmation.setAttribute('aria-describedby', status.id);
    group.append(label, confirmation, status); form.insertBefore(group, error);
    let touched = false, busy = false;
    const clearErrors = () => {
      error.textContent = '';
      for (const field of [username, password, confirmation]) field.removeAttribute('aria-invalid');
    };
    function updateConfirmation() {
      const show = isRegister() && (touched || confirmation.value.length > 0);
      const matches = !!confirmation.value && confirmation.value === password.value;
      status.textContent = !show ? '' : !confirmation.value ? '비밀번호를 한 번 더 입력해 주세요.' : matches ? '비밀번호가 일치합니다.' : '비밀번호가 일치하지 않습니다.';
      status.classList.toggle('is-match', show && matches);
      status.classList.toggle('is-error', show && !matches);
      confirmation.setAttribute('aria-invalid', String(show && !matches));
    }
    function syncMode() {
      const register = isRegister();
      nameHelp.hidden = passwordHelp.hidden = group.hidden = !register;
      confirmation.disabled = !register; confirmation.required = register;
      confirmation.value = ''; touched = false; clearErrors(); updateConfirmation();
      document.getElementById('f-forgot').closest('p').hidden = register;
      document.getElementById('forgot-note').classList.add('hidden');
    }
    for (const tab of tabs) tab.addEventListener('click', syncMode);
    for (const field of [username, password, confirmation]) field.addEventListener('input', () => { clearErrors(); updateConfirmation(); });
    confirmation.addEventListener('blur', () => { touched = true; updateConfirmation(); });
    const submit = form.onsubmit;
    form.onsubmit = async function (event) {
      event.preventDefault();
      if (busy) return;
      clearErrors();
      const invalid = validate(username.value, password.value, confirmation.value, isRegister());
      if (invalid) {
        if (invalid.field === confirmation.id) { touched = true; updateConfirmation(); }
        error.textContent = invalid.message;
        const field = document.getElementById(invalid.field);
        field.setAttribute('aria-invalid', 'true'); field.focus(); return;
      }
      username.value = normalizeName(username.value);
      busy = true;
      try { await submit.call(this, event); }
      finally {
        busy = false;
        if (!password.value) { confirmation.value = ''; touched = false; updateConfirmation(); }
      }
    };
    syncMode();
  };
})();
