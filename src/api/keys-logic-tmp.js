  /* ---------------- api keys ---------------- */

  var apiKeys = [];
  var keyPerms = [];

  function loadApiKeys() {
    api("/api/keys").then(function (data) {
      state.apiKeys = data.keys;
      renderApiKeys();
    }).catch(fail);
  }

  function renderApiKeys() {
    var rows = "";
    if (!state.apiKeys.length) { rows = '<tr><td colspan="5" class="empty">暂无 API 密钥</td></tr>'; }
    for (var i = 0; i < state.apiKeys.length; i++) {
      var k = state.apiKeys[i];
      var scopeChips = k.scopes ? k.scopes.split(',').map(function(s) { return '<span class="chip mono">' + esc(s) + '</span>'; }).join('') : '<span class="muted">无</span>';
      rows += '<tr><td class="mono">' + esc(k.key_prefix) + '…</td><td>' + esc(k.name) + '</td><td>' + scopeChips + '</td><td class="muted">' + esc(k.created_at || '') + '</td><td class="muted">' + esc(k.last_used_at || '从未') + '</td><td class="actions"><button class="btn small danger" data-action="revoke-key" data-id="' + esc(k.id) + '">吊销</button></td></tr>';
    }
    $("tab-keys").innerHTML =
      '<div class="card">' +
      '<div class="toolbar"><span class="count">共 ' + state.apiKeys.length + ' 个密钥</span><span style="flex:1"></span><button class="btn primary" data-action="create-key">创建 API 密钥</button></div>' +
      '<table><thead><tr><th>前缀</th><th>名称</th><th>Scopes</th><th>最后使用</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  function openCreateKeyModal() {
    var checks = '';
    for (var i = 0; i < state.permissions.length; i++) {
      var p = state.permissions[i];
      checks += '<label><input type="checkbox" value="' + esc(p.code) + '" name="key-scope"> <span class="mono">' + esc(p.code) + '</span> <span class="muted">' + esc(p.description) + '</span></label>';
    }
    openModal(
      '<h3>创建 API 密钥</h3>' +
      '<label>名称</label><input type="text" id="key-name" placeholder="例如：my-agent">' +
      '<label>Scopes（勾选要授予的权限）</label>' +
      '<div class="checklist">' + checks + '</div>' +
      '<div class="footer"><button class="btn" onclick="closeModal()">取消</button>' +
      '<button class="btn primary" data-action="submit-create-key">创建</button></div>'
    );
  }

  function submitCreateKey() {
    var name = $('key-name') ? $('key-name').value.trim() : '';
    if (!name) { toast('请输入名称', true); return; }
    var boxes = document.querySelectorAll('input[name="key-scope"]');
    var scopes = [];
    for (var i = 0; i < boxes.length; i++) if (boxes[i].checked) scopes.push(boxes[i].value);
    api('/api/keys', { method: 'POST', body: JSON.stringify({ name: name, scopes: scopes }) })
      .then(function () { closeModal(); toast('API 密钥已创建'); loadApiKeys(); })
      .catch(fail);
  }

  function revokeKeyFn(id) {
    if (!confirm('确定吊销该 API 密钥？使用它的应用将立即失去访问权限。')) return;
    api('/api/keys/' + id, { method: 'DELETE' })
      .then(function () { toast('密钥已吊销'); loadApiKeys(); })
      .catch(fail);
  }