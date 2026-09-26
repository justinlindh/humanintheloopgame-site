const gallery = document.getElementById('office-gallery');
const controls = document.querySelector('.gallery-controls');
const arrows = [...controls.querySelectorAll('button')];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

function updateArrows() {
  const end = gallery.scrollWidth - gallery.clientWidth;
  arrows[0].setAttribute('aria-disabled', gallery.scrollLeft <= 1);
  arrows[1].setAttribute('aria-disabled', gallery.scrollLeft >= end - 1);
}

function moveGallery(direction) {
  const end = gallery.scrollWidth - gallery.clientWidth;
  const origin = gallery.getBoundingClientRect().left;
  const positions = [...gallery.children].map((figure) => Math.min(end,
    figure.getBoundingClientRect().left - origin + gallery.scrollLeft));
  const target = direction > 0
    ? positions.find((left) => left > gallery.scrollLeft + 1) ?? end
    : positions.reverse().find((left) => left < gallery.scrollLeft - 1) ?? 0;
  scrollGallery(target);
}

function scrollGallery(left) {
  gallery.scrollTo({ left, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
}

for (const arrow of arrows) {
  arrow.addEventListener('click', () => {
    if (arrow.getAttribute('aria-disabled') !== 'true') moveGallery(Number(arrow.dataset.galleryDirection));
  });
}

gallery.addEventListener('keydown', (event) => {
  // Leave the clip's own controls and browser shortcuts alone.
  if (event.target !== gallery || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  if (event.key === 'Home') scrollGallery(0);
  else if (event.key === 'End') scrollGallery(gallery.scrollWidth);
  else moveGallery(event.key === 'ArrowRight' ? 1 : -1);
});

gallery.addEventListener('scroll', updateArrows, { passive: true });
new ResizeObserver(updateArrows).observe(gallery);
gallery.setAttribute('aria-describedby', 'office-help');
controls.hidden = false;
updateArrows();
