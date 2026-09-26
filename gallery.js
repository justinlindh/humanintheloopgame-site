// Arrow, swipe and key controls for each horizontal strip that has a .gallery-controls block:
// the block's buttons name their strip with aria-controls.
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

for (const controls of document.querySelectorAll('.gallery-controls')) {
  const arrows = [...controls.querySelectorAll('button')];
  const gallery = document.getElementById(arrows[0]?.getAttribute('aria-controls'));
  if (!gallery) continue;

  const updateArrows = () => {
    const end = gallery.scrollWidth - gallery.clientWidth;
    arrows[0].setAttribute('aria-disabled', gallery.scrollLeft <= 1);
    arrows[1].setAttribute('aria-disabled', gallery.scrollLeft >= end - 1);
  };
  const scrollGallery = (left) => gallery.scrollTo({ left, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
  const moveGallery = (direction) => {
    const end = gallery.scrollWidth - gallery.clientWidth;
    const origin = gallery.getBoundingClientRect().left;
    const positions = [...gallery.children].map((item) => Math.min(end,
      item.getBoundingClientRect().left - origin + gallery.scrollLeft));
    const target = direction > 0
      ? positions.find((left) => left > gallery.scrollLeft + 1) ?? end
      : positions.reverse().find((left) => left < gallery.scrollLeft - 1) ?? 0;
    scrollGallery(target);
  };

  for (const arrow of arrows) {
    arrow.addEventListener('click', () => {
      if (arrow.getAttribute('aria-disabled') !== 'true') moveGallery(Number(arrow.dataset.galleryDirection));
    });
  }

  gallery.addEventListener('keydown', (event) => {
    // Leave the clips' own controls and browser shortcuts alone.
    if (event.target !== gallery || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home') scrollGallery(0);
    else if (event.key === 'End') scrollGallery(gallery.scrollWidth);
    else moveGallery(event.key === 'ArrowRight' ? 1 : -1);
  });

  gallery.addEventListener('scroll', updateArrows, { passive: true });
  new ResizeObserver(updateArrows).observe(gallery);
  const help = controls.querySelector('p[id]');
  if (help) gallery.setAttribute('aria-describedby', help.id);
  gallery.dataset.controlled = '';
  controls.hidden = false;
  updateArrows();
}
