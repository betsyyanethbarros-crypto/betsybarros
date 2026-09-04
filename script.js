const articleId = document.body.dataset.articleId || 'vivir-la-ciudad-desde-la-inseguridad';
const articleTitle = document.body.dataset.articleTitle || document.title;

async function shareArticle(button) {
  const data = {
    title: articleTitle,
    text: `Lee este artículo de Betsy Barros Núñez: ${articleTitle}`,
    url: window.location.href
  };
  if (navigator.share) {
    try { await navigator.share(data); } catch (e) {}
  } else {
    try {
      await navigator.clipboard.writeText(window.location.href);
      const old = button.textContent;
      button.textContent = 'Enlace copiado';
      setTimeout(() => button.textContent = old, 1800);
    } catch (e) {}
  }
}

document.getElementById('shareBtn')?.addEventListener('click', e => shareArticle(e.currentTarget));
document.getElementById('shareBtnBottom')?.addEventListener('click', e => shareArticle(e.currentTarget));

document.getElementById('copyBtn')?.addEventListener('click', async e => {
  try {
    await navigator.clipboard.writeText(window.location.href);
    e.currentTarget.textContent = 'Copiado';
    setTimeout(() => e.currentTarget.textContent = 'Copiar enlace', 1800);
  } catch (err) {}
});

const form = document.getElementById('commentForm');
const list = document.getElementById('commentsList');
const statusEl = document.getElementById('commentStatus');
const storageKey = `betsy-barros-comments-${articleId}`;
let publicCommentsAvailable = false;

function escapeHtml(str='') {
  return String(str).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[ch]));
}

function localComments() {
  try { return JSON.parse(localStorage.getItem(storageKey)) || []; }
  catch { return []; }
}

function saveLocalComments(comments) {
  localStorage.setItem(storageKey, JSON.stringify(comments));
}

function renderComments(comments) {
  if (!list) return;
  list.innerHTML = comments.length ? comments.map(c => `
    <article class="comment">
      <div class="comment-head"><strong>${escapeHtml(c.name)}</strong><time>${new Date(c.createdAt).toLocaleString('es-CO', {dateStyle:'medium', timeStyle:'short'})}</time></div>
      <p>${escapeHtml(c.text)}</p>
    </article>`).join('') : '<p class="demo-note">Todavía no hay comentarios. Sé la primera persona en participar.</p>';
}

async function loadComments() {
  if (!list) return;
  if (location.protocol === 'http:' || location.protocol === 'https:') {
    try {
      const response = await fetch(`comments.php?article=${encodeURIComponent(articleId)}`, {headers:{'Accept':'application/json'}});
      if (!response.ok) throw new Error('API no disponible');
      const data = await response.json();
      if (!data.ok || !Array.isArray(data.comments)) throw new Error('Respuesta inválida');
      publicCommentsAvailable = true;
      renderComments(data.comments);
      if (statusEl) statusEl.textContent = 'Los comentarios publicados aquí son visibles para todos los lectores.';
      return;
    } catch (e) {
      publicCommentsAvailable = false;
    }
  }
  renderComments(localComments());
  if (statusEl) statusEl.textContent = 'Vista previa local: mientras el sitio no esté alojado en un servidor compatible, los comentarios se guardan solo en este navegador.';
}

form?.addEventListener('submit', async e => {
  e.preventDefault();
  const name = document.getElementById('commentName').value.trim();
  const text = document.getElementById('commentText').value.trim();
  const website = document.getElementById('commentWebsite').value.trim();
  if (!name || !text || website) return;

  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  submit.textContent = 'Publicando…';

  if (publicCommentsAvailable) {
    try {
      const response = await fetch('comments.php', {
        method: 'POST',
        headers: {'Content-Type':'application/json','Accept':'application/json'},
        body: JSON.stringify({article: articleId, name, text, website})
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'No se pudo publicar');
      form.reset();
      if (statusEl) statusEl.textContent = 'Comentario publicado.';
      await loadComments();
    } catch (err) {
      if (statusEl) statusEl.textContent = 'No fue posible publicar el comentario en este momento.';
    }
  } else {
    const comments = localComments();
    comments.unshift({name, text, createdAt: new Date().toISOString()});
    saveLocalComments(comments);
    form.reset();
    renderComments(comments);
    if (statusEl) statusEl.textContent = 'Comentario guardado en esta vista previa local.';
  }

  submit.disabled = false;
  submit.textContent = 'Publicar comentario';
});

loadComments();


const facebookShareLink = document.getElementById('facebookShareLink');
if (facebookShareLink) {
  const shareUrl = 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(window.location.href);
  facebookShareLink.setAttribute('href', shareUrl);
}


async function copyPublicLink(button, url) {
  try {
    await navigator.clipboard.writeText(url);
    const old = button.textContent;
    button.textContent = 'Enlace copiado';
    setTimeout(() => button.textContent = old, 1800);
  } catch (e) {}
}
document.getElementById('copySiteLink')?.addEventListener('click', e => copyPublicLink(e.currentTarget, 'https://betsybarros.vercel.app/'));
document.getElementById('copyBlogLink')?.addEventListener('click', e => copyPublicLink(e.currentTarget, 'https://betsybarros.vercel.app/blog.html'));
