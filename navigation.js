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


// There are two "My way" sections - a desktop layout and a tablet/mobile
// layout - and only one is displayed at a time. The menu link points at
// #my-way (the desktop one); when that section is hidden by the
// breakpoint, scroll to the visible mobile version instead.
const myWayLink = document.querySelector('.navigation a[href="#my-way"]');
if (myWayLink) {
    myWayLink.addEventListener('click', (e) => {
        const desktop = document.getElementById('my-way');
        const mobile = document.getElementById('my-way-mobile');
        if (desktop && mobile && desktop.offsetParent === null) {
            e.preventDefault();
            mobile.scrollIntoView({ behavior: 'smooth' });
            history.replaceState(null, '', '#my-way');
        }
    });
}
