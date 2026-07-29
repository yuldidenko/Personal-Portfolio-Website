const burgerIcon = document.querySelector('.burger-icon');
const navMenu = document.querySelector('.navigation ul');


burgerIcon.addEventListener('click', () => {
    const isOpen = burgerIcon.classList.toggle('active');
    navMenu.classList.toggle('active');
    burgerIcon.setAttribute('aria-expanded', String(isOpen));
});


document.querySelectorAll('.navigation ul li a').forEach(link => {
    link.addEventListener('click', () => {
        burgerIcon.classList.remove('active');
        navMenu.classList.remove('active');
        burgerIcon.setAttribute('aria-expanded', 'false');
    });
});