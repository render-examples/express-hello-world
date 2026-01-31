function showScreen(id) {
  document.querySelectorAll('div').forEach(div => div.style.display = 'none');
  document.getElementById(id).style.display = 'block';
}
