let ideas = [];
let currentFilter = 'all';
let currentCategoryFilter = 'all';
let currentSearch = '';
let currentSort = 'date-desc';

document.addEventListener('DOMContentLoaded', () => {
  // 配置marked
  if (typeof marked !== 'undefined') {
    marked.setOptions({
      breaks: true,
      gfm: true,
      sanitize: false
    });
  }
  
  loadIdeas();
  setupEventListeners();
  
  // 初始化KaTeX自动渲染
  if (typeof renderMathInElement === 'function') {
    renderMathInElement(document.body, {
      delimiters: [
        {left: '$$', right: '$$', display: true},
        {left: '$', right: '$', display: false},
        {left: '\\(', right: '\\)', display: false},
        {left: '\\[', right: '\\]', display: true}
      ],
      throwOnError: false
    });
  }
});

async function loadIdeas() {
  const result = await window.electronAPI.loadData();
  if (result.success) {
    ideas = result.data;
    renderIdeas();
    renderTagsFilter();
    renderCategoriesFilter();
  } else {
    console.error('Failed to load ideas:', result.error);
  }
}

async function saveIdeas() {
  const result = await window.electronAPI.saveData(ideas);
  if (!result.success) {
    console.error('Failed to save ideas:', result.error);
  }
}

function setupEventListeners() {
  document.getElementById('add-idea-btn').addEventListener('click', openAddModal);
  document.getElementById('cancel-btn').addEventListener('click', closeModal);
  document.querySelector('.close-btn').addEventListener('click', closeModal);
  document.getElementById('idea-form').addEventListener('submit', handleFormSubmit);
  document.getElementById('search-input').addEventListener('input', handleSearch);
  
  document.getElementById('tags-filter').addEventListener('click', (e) => {
    if (e.target.classList.contains('tag-filter')) {
      handleTagFilter(e.target);
    }
  });
  
  document.getElementById('categories-filter').addEventListener('click', (e) => {
    if (e.target.classList.contains('category-filter')) {
      handleCategoryFilter(e.target);
    }
  });
  
  document.getElementById('sort-select').addEventListener('change', handleSortChange);
  
  document.getElementById('export-btn').addEventListener('click', exportData);
  document.getElementById('import-btn').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });
  document.getElementById('import-file').addEventListener('change', importData);
  document.getElementById('manage-tags-btn').addEventListener('click', openTagsModal);
  document.getElementById('close-tags-btn').addEventListener('click', closeTagsModal);
  document.getElementById('close-tags-modal').addEventListener('click', closeTagsModal);
  document.getElementById('toggle-details-btn').addEventListener('click', toggleDetails);
  
  document.getElementById('ideas-list').addEventListener('click', (e) => {
    const target = e.target.closest('button');
    if (!target) return;
    
    const ideaCard = target.closest('.idea-card');
    const ideaId = ideaCard?.dataset.id;
    
    if (target.classList.contains('edit-btn')) {
      openEditModal(ideaId);
    } else if (target.classList.contains('delete-btn')) {
      deleteIdea(ideaId);
    }
  });
  
  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
      closeModal();
    }
  });
}

function renderIdeas() {
  const container = document.getElementById('ideas-list');
  const filteredIdeas = filterIdeas();
  
  if (filteredIdeas.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>暂无Idea</h3>
        <p>点击右上角的"新增Idea"按钮来添加你的第一个研究想法</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = filteredIdeas.map(idea => `
    <div class="idea-card" data-id="${idea.id}">
      <div class="idea-header">
        <h3 class="idea-title">${escapeHtml(idea.title)}</h3>
        <div class="idea-actions">
          <button class="edit-btn" title="编辑">✏️</button>
          <button class="delete-btn" title="删除">🗑️</button>
        </div>
      </div>
      ${idea.description ? `<div class="idea-description markdown-content">${parseMarkdown(idea.description)}</div>` : ''}
      <div class="idea-meta">
        ${idea.category ? `<span class="idea-category">${escapeHtml(idea.category)}</span>` : ''}
        ${idea.priority ? `<span class="idea-priority priority-${idea.priority}">${getPriorityText(idea.priority)}</span>` : ''}
      </div>
      ${idea.tags && idea.tags.length > 0 ? `
        <div class="idea-tags">
          ${idea.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
        </div>
      ` : ''}
      ${idea.attachments && idea.attachments.length > 0 ? `
        <div class="idea-attachments">
          ${idea.attachments.map(url => `<a href="${escapeHtml(url)}" target="_blank" class="attachment-link">📎 附件</a>`).join('')}
        </div>
      ` : ''}
      ${idea.date ? `<div class="idea-date">${formatDate(idea.date)}</div>` : ''}
    </div>
  `).join('');
  
  // 渲染数学公式
  renderMathFormulas();
}

function renderTagsFilter() {
  const container = document.getElementById('tags-filter');
  const allTags = [...new Set(ideas.flatMap(idea => idea.tags || []))];
  
  container.innerHTML = `
    <button class="tag-filter ${currentFilter === 'all' ? 'active' : ''}" data-tag="all">全部</button>
    ${allTags.map(tag => `
      <button class="tag-filter ${currentFilter === tag ? 'active' : ''}" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>
    `).join('')}
  `;
}

function renderCategoriesFilter() {
  const container = document.getElementById('categories-filter');
  const allCategories = [...new Set(ideas.map(idea => idea.category).filter(Boolean))];
  
  container.innerHTML = `
    <button class="category-filter ${currentCategoryFilter === 'all' ? 'active' : ''}" data-category="all">全部</button>
    ${allCategories.map(category => `
      <button class="category-filter ${currentCategoryFilter === category ? 'active' : ''}" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>
    `).join('')}
  `;
}

function filterIdeas() {
  let filtered = ideas.filter(idea => {
    const matchesTag = currentFilter === 'all' || (idea.tags && idea.tags.includes(currentFilter));
    const matchesCategory = currentCategoryFilter === 'all' || idea.category === currentCategoryFilter;
    const matchesSearch = currentSearch === '' || 
      idea.title.toLowerCase().includes(currentSearch.toLowerCase()) ||
      (idea.description && idea.description.toLowerCase().includes(currentSearch.toLowerCase()));
    return matchesTag && matchesCategory && matchesSearch;
  });
  
  // Sort the filtered ideas
  filtered.sort((a, b) => {
    switch (currentSort) {
      case 'date-desc':
        return new Date(b.date || 0) - new Date(a.date || 0);
      case 'date-asc':
        return new Date(a.date || 0) - new Date(b.date || 0);
      case 'title-asc':
        return a.title.localeCompare(b.title);
      case 'title-desc':
        return b.title.localeCompare(a.title);
      case 'priority-desc':
        return getPriorityWeight(b.priority) - getPriorityWeight(a.priority);
      case 'priority-asc':
        return getPriorityWeight(a.priority) - getPriorityWeight(b.priority);
      default:
        return 0;
    }
  });
  
  return filtered;
}

function getPriorityWeight(priority) {
  switch (priority) {
    case 'high': return 3;
    case 'medium': return 2;
    case 'low': return 1;
    default: return 0;
  }
}

function handleTagFilter(button) {
  currentFilter = button.dataset.tag;
  document.querySelectorAll('.tag-filter').forEach(btn => btn.classList.remove('active'));
  button.classList.add('active');
  renderIdeas();
}

function handleCategoryFilter(button) {
  currentCategoryFilter = button.dataset.category;
  document.querySelectorAll('.category-filter').forEach(btn => btn.classList.remove('active'));
  button.classList.add('active');
  renderIdeas();
}

function handleSortChange(e) {
  currentSort = e.target.value;
  renderIdeas();
}

function handleSearch(e) {
  currentSearch = e.target.value;
  renderIdeas();
}

function exportData() {
  const dataStr = JSON.stringify(ideas, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `research-ideas-${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const importedIdeas = JSON.parse(event.target.result);
      if (Array.isArray(importedIdeas)) {
        ideas = importedIdeas;
        saveIdeas();
        renderIdeas();
        renderTagsFilter();
        renderCategoriesFilter();
        alert('数据导入成功！');
      } else {
        alert('导入失败：文件格式不正确');
      }
    } catch (error) {
      alert('导入失败：文件解析错误');
      console.error('Import error:', error);
    }
  };
  reader.readAsText(file);
  e.target.value = ''; // Reset file input
}

function openTagsModal() {
  renderTagsList();
  document.getElementById('tags-modal').classList.add('active');
}

function closeTagsModal() {
  document.getElementById('tags-modal').classList.remove('active');
}

function renderTagsList() {
  const container = document.getElementById('tags-list');
  const allTags = [...new Set(ideas.flatMap(idea => idea.tags || []))];
  
  if (allTags.length === 0) {
    container.innerHTML = '<p>暂无标签</p>';
    return;
  }
  
  container.innerHTML = allTags.map(tag => `
    <div class="tag-item" data-tag="${escapeHtml(tag)}">
      <span class="tag-name">${escapeHtml(tag)}</span>
      <div class="tag-actions">
        <button class="rename-tag-btn" title="重命名">✏️</button>
        <button class="delete-tag-btn" title="删除">🗑️</button>
      </div>
    </div>
  `).join('');
  
  container.querySelectorAll('.rename-tag-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tagItem = e.target.closest('.tag-item');
      const oldTag = tagItem.dataset.tag;
      const newTag = prompt('请输入新的标签名称：', oldTag);
      if (newTag && newTag.trim() && newTag.trim() !== oldTag) {
        renameTag(oldTag, newTag.trim());
      }
    });
  });
  
  container.querySelectorAll('.delete-tag-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tagItem = e.target.closest('.tag-item');
      const tag = tagItem.dataset.tag;
      if (confirm(`确定要删除标签"${tag}"吗？这将从所有idea中移除该标签。`)) {
        deleteTag(tag);
      }
    });
  });
}

function renameTag(oldTag, newTag) {
  ideas.forEach(idea => {
    if (idea.tags && idea.tags.includes(oldTag)) {
      idea.tags = idea.tags.map(tag => tag === oldTag ? newTag : tag);
    }
  });
  saveIdeas();
  renderIdeas();
  renderTagsFilter();
  renderTagsList();
}

function deleteTag(tag) {
  ideas.forEach(idea => {
    if (idea.tags) {
      idea.tags = idea.tags.filter(t => t !== tag);
    }
  });
  saveIdeas();
  renderIdeas();
  renderTagsFilter();
  renderTagsList();
}

function openAddModal() {
  document.getElementById('modal-title').textContent = '新增Idea';
  document.getElementById('idea-id').value = '';
  document.getElementById('idea-form').reset();
  document.getElementById('idea-date').valueAsDate = new Date();
  document.getElementById('idea-priority').value = 'medium';
  
  // 折叠详细选项
  const collapsibleFields = document.querySelector('.collapsible-fields');
  const toggleBtn = document.getElementById('toggle-details-btn');
  collapsibleFields.classList.remove('expanded');
  toggleBtn.textContent = '展开详细选项';
  
  openModal();
}

function openEditModal(id) {
  const idea = ideas.find(i => i.id === id);
  if (!idea) return;
  
  document.getElementById('modal-title').textContent = '编辑Idea';
  document.getElementById('idea-id').value = idea.id;
  document.getElementById('idea-title').value = idea.title;
  document.getElementById('idea-description').value = idea.description || '';
  document.getElementById('idea-tags').value = idea.tags ? idea.tags.join(', ') : '';
  document.getElementById('idea-category').value = idea.category || '';
  document.getElementById('idea-priority').value = idea.priority || 'medium';
  document.getElementById('idea-attachments').value = idea.attachments ? idea.attachments.join('\n') : '';
  document.getElementById('idea-date').value = idea.date || '';
  
  // 展开详细选项
  const collapsibleFields = document.querySelector('.collapsible-fields');
  const toggleBtn = document.getElementById('toggle-details-btn');
  collapsibleFields.classList.add('expanded');
  toggleBtn.textContent = '折叠详细选项';
  
  openModal();
}

function openModal() {
  document.getElementById('idea-modal').classList.add('active');
  document.getElementById('idea-title').focus();
}

function closeModal() {
  document.getElementById('idea-modal').classList.remove('active');
}

function handleFormSubmit(e) {
  e.preventDefault();
  
  const id = document.getElementById('idea-id').value;
  const title = document.getElementById('idea-title').value.trim();
  const description = document.getElementById('idea-description').value.trim();
  const tagsInput = document.getElementById('idea-tags').value;
  const category = document.getElementById('idea-category').value.trim();
  const priority = document.getElementById('idea-priority').value;
  const attachmentsInput = document.getElementById('idea-attachments').value;
  const date = document.getElementById('idea-date').value;
  
  const tags = tagsInput
    .split(',')
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0);
  
  const attachments = attachmentsInput
    .split('\n')
    .map(url => url.trim())
    .filter(url => url.length > 0);
  
  if (id) {
    const index = ideas.findIndex(i => i.id === id);
    if (index !== -1) {
      ideas[index] = { id, title, description, tags, category, priority, attachments, date };
    }
  } else {
    ideas.push({
      id: generateId(),
      title,
      description,
      tags,
      category,
      priority,
      attachments,
      date
    });
  }
  
  saveIdeas();
  renderIdeas();
  renderTagsFilter();
  renderCategoriesFilter();
  closeModal();
}

function deleteIdea(id) {
  if (!confirm('确定要删除这个Idea吗？')) return;
  
  ideas = ideas.filter(i => i.id !== id);
  saveIdeas();
  renderIdeas();
  renderTagsFilter();
  renderCategoriesFilter();
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function getPriorityText(priority) {
  switch (priority) {
    case 'high': return '高优先级';
    case 'medium': return '中优先级';
    case 'low': return '低优先级';
    default: return '';
  }
}

function toggleDetails() {
  const collapsibleFields = document.querySelector('.collapsible-fields');
  const toggleBtn = document.getElementById('toggle-details-btn');
  
  if (collapsibleFields.classList.contains('expanded')) {
    collapsibleFields.classList.remove('expanded');
    toggleBtn.textContent = '展开详细选项';
  } else {
    collapsibleFields.classList.add('expanded');
    toggleBtn.textContent = '折叠详细选项';
  }
}

function parseMarkdown(text) {
  if (!text) return '';
  try {
    // 保护LaTeX公式不被marked转义
    const mathBlocks = [];
    let processedText = text;
    
    // 保护块级公式 $$...$$
    processedText = processedText.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
      const index = mathBlocks.length;
      mathBlocks.push(`$$${formula}$$`);
      return `%%MATHBLOCK${index}%%`;
    });
    
    // 保护行内公式 $...$
    processedText = processedText.replace(/\$([^\$\n]+?)\$/g, (match, formula) => {
      const index = mathBlocks.length;
      mathBlocks.push(`$${formula}$`);
      return `%%MATHBLOCK${index}%%`;
    });
    
    // 保护LaTeX环境 \[...\] 和 \(...\)
    processedText = processedText.replace(/\\\[([\s\S]*?)\\\]/g, (match, formula) => {
      const index = mathBlocks.length;
      mathBlocks.push(`\\[${formula}\\]`);
      return `%%MATHBLOCK${index}%%`;
    });
    
    processedText = processedText.replace(/\\\(([\s\S]*?)\\\)/g, (match, formula) => {
      const index = mathBlocks.length;
      mathBlocks.push(`\\(${formula}\\)`);
      return `%%MATHBLOCK${index}%%`;
    });
    
    // 解析Markdown
    let html = marked.parse(processedText);
    
    // 恢复LaTeX公式
    mathBlocks.forEach((formula, index) => {
      html = html.replace(`%%MATHBLOCK${index}%%`, formula);
    });
    
    return html;
  } catch (error) {
    console.error('Markdown parsing error:', error);
    return escapeHtml(text);
  }
}

function renderMathFormulas() {
  if (typeof renderMathInElement === 'function') {
    renderMathInElement(document.getElementById('ideas-list'), {
      delimiters: [
        {left: '$$', right: '$$', display: true},
        {left: '$', right: '$', display: false},
        {left: '\\(', right: '\\)', display: false},
        {left: '\\[', right: '\\]', display: true}
      ],
      throwOnError: false
    });
  }
}