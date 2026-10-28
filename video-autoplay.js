// The My way video plays only while it's on screen: it isn't downloaded
// until it scrolls near the viewport (preload="none" in the markup), and
// it pauses again when scrolled away so it doesn't burn CPU and data in
// the background. Visitors who ask for reduced motion get the poster
// frame and can press play themselves.
document.addEventListener("DOMContentLoaded", () => {
  const videos = document.querySelectorAll("video[data-autoplay]");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (!videos.length || !("IntersectionObserver" in window)) return;

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach(({ target: video, isIntersecting }) => {
        if (isIntersecting && !reduceMotion.matches) {
          const playing = video.play();
          if (playing) playing.catch(() => {});
        } else if (!isIntersecting) {
          video.pause();
        }
      });
    },
    { threshold: 0.25 }
  );
  videos.forEach((video) => io.observe(video));
});
