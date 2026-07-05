window.addEventListener('load', () => {
  const loader = document.getElementById('loader');
  if (!loader) return;

  setTimeout(() => {
    loader.classList.add('fade-out');
  }, 2000);
});

document.addEventListener('DOMContentLoaded', () => {
  const floatingContact = document.getElementById('floatingContact');
  const toggleButton = document.getElementById('floatingContactToggle');
  const menu = document.getElementById('floatingContactMenu');

  if (!floatingContact || !toggleButton) return;

  const toggleIcon = toggleButton.querySelector('i');
  const menuItems = menu ? menu.querySelectorAll('a, button') : [];

  function setFloatingContactOpen(isOpen) {
    floatingContact.classList.toggle('is-open', isOpen);
    toggleButton.setAttribute('aria-expanded', String(isOpen));
    toggleButton.setAttribute('aria-label', isOpen ? '收合聯絡方式' : '展開聯絡方式');
    if (menu) {
      menu.setAttribute('aria-hidden', String(!isOpen));
    }
    menuItems.forEach((item) => {
      item.tabIndex = isOpen ? 0 : -1;
    });

    if (toggleIcon) {
      toggleIcon.classList.toggle('bi-chat-dots-fill', !isOpen);
      toggleIcon.classList.toggle('bi-x-lg', isOpen);
    }
  }

  toggleButton.addEventListener('click', () => {
    setFloatingContactOpen(!floatingContact.classList.contains('is-open'));
  });

  document.addEventListener('click', (event) => {
    if (!floatingContact.contains(event.target)) {
      setFloatingContactOpen(false);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      setFloatingContactOpen(false);
      toggleButton.blur();
    }
  });

  setFloatingContactOpen(false);
});
