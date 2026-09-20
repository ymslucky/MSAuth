
(function () {
  var state = { tab: "users", page: 1, pageSize: 20, q: "", total: 0, editId: null,
    users: [], roles: [], permissions: [], me: null };

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  var ERROR_TEXT = {
    unauthorized: "未登录或会话已过期",
    forbidden: "没有执行该操作的权限",
    email_taken: "该邮箱已被其他用户使用",
    role_taken: "角色名已存在",
    permission_taken: "权限码已存在",
    invalid_email: "邮箱格式不正确",
    invalid_name: "名称格式不正确",
    invalid_code: "权限码格式应为 resource:action",
    invalid_roles: "角色参数不正确",
    unknown_role: "包含未知角色",
    last_admin: "必须保留至少一名管理员",
    cannot_delete_self: "不能删除当前登录的账号",
    builtin_role: "内置角色不可删除",
    not_found: "目标不存在",
    error: "操作失败，请重试"
  };

  function api(path, opts) {
    opts = opts || {};
    if (opts.body) {
      opts.headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
    }
    return fetch(path, opts).then(function (res) {
      if (res.status === 401) { location.href = "/admin/login"; throw new Error("unauthorized"); }
      return res.json().then(function (data) {
        if (!res.ok) {
          var err = new Error(ERROR_TEXT[data.error] || ERROR_TEXT.error);
          err.code = data.error; err.status = res.status;
          throw err;
        }
        return data;
      });
    });
  }

  var toastTimer = null;
  function toast(msg, isError) {
    var el = $("toast");
    el.textContent = msg;
    el.className = "show" + (isError ? " error" : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.className = ""; }, 2500);
  }
  function fail(err) { toast(err.message || ERROR_TEXT.error, true); }

  function roleChips(roles) {
    if (!roles || !roles.length) return '<span class="muted">无</span>';
    return roles.map(function (r) {
      return '<span class="chip' + (r === "admin" ? " admin" : "") + '">' + esc(r) + "</span>";
    }).join("");
  }

  function closeModal() { $("modal-root").innerHTML = ""; }

  function openModal(html) {
    $("modal-root").innerHTML =
      '<div class="overlay" data-action="overlay-close"><div class="modal">' + html + "</div></div>";
  }

  /* ---------------- delegated clicks ---------------- */

  document.addEventListener("click", function (e) {
    var el = e.target && e.target.closest ? e.target.closest("[data-action]") : null;
    if (!el) return;
    var action = el.getAttribute("data-action");
    var id = el.getAttribute("data-id") || "";
    if (action === "overlay-close" && e.target !== el) return;
    if (action === "overlay-close") { closeModal(); return; }
    if (action === "close-modal") { closeModal(); return; }
    if (action === "logout") { location.href = "/admin/logout"; return; }
    if (action === "do-search") {
      var q = $("search") ? $("search").value.trim() : "";
      state.q = q; state.page = 1; loadUsers(); return;
    }
    if (action === "goto-page") {
      var delta = parseInt(el.getAttribute("data-delta"), 10) || 0;
      var next = state.page + delta;
      if (next >= 1 && next <= totalPages()) { state.page = next; loadUsers(); }
      return;
    }
    if (action === "add-permission") {
      var body = {
        code: $("perm-code").value.trim(),
        description: $("perm-desc").value.trim()
      };
      if (!body.code) { toast("请输入权限码", true); return; }
      api("/api/permissions", { method: "POST", body: JSON.stringify(body) })
        .then(function () { toast("权限已新增"); loadPermissions(); })
        .catch(fail);
      return;
    }
    if (action === "start-edit-email") { state.editId = id; renderUsers(); return; }
    if (action === "cancel-edit-email") { state.editId = null; renderUsers(); return; }
    if (action === "save-edit-email") {
      var email = $("edit-" + id).value.trim();
      api("/api/users/" + id, { method: "PATCH", body: JSON.stringify({ email: email }) })
        .then(function () { state.editId = null; toast("邮箱已更新"); loadUsers(); })
        .catch(fail);
      return;
    }
    if (action === "open-assign") { openAssign(id); return; }
    if (action === "submit-assign") {
      var boxes = document.querySelectorAll('input[name="assign-role"]');
      var roles = [];
      for (var i = 0; i < boxes.length; i++) if (boxes[i].checked) roles.push(boxes[i].value);
      api("/api/users/" + id + "/roles", { method: "PUT", body: JSON.stringify({ roles: roles }) })
        .then(function () { closeModal(); toast("角色已更新"); loadUsers(); })
        .catch(fail);
      return;
    }
    if (action === "remove-user") {
      if (!confirm("确定删除该用户？此操作不可恢复。")) return;
      api("/api/users/" + id, { method: "DELETE" })
        .then(function () { toast("用户已删除"); loadUsers(); })
        .catch(fail);
      return;
    }
    if (action === "open-role-editor") { openRoleEditor(id || null); return; }
    if (action === "submit-role") {
      var body = {
        name: $("role-name").value.trim(),
        description: $("role-desc").value.trim(),
        permissions: []
      };
      var pboxes = document.querySelectorAll('input[name="role-permission"]');
      for (var j = 0; j < pboxes.length; j++) if (pboxes[j].checked) body.permissions.push(pboxes[j].value);
      var req = id
        ? api("/api/roles/" + id, { method: "PATCH", body: JSON.stringify(body) })
        : api("/api/roles", { method: "POST", body: JSON.stringify(body) });
      req.then(function () { closeModal(); toast("已保存"); loadRoles(); }).catch(fail);
      return;
    }
    if (action === "remove-role") {
      var role = null;
      for (var k = 0; k < state.roles.length; k++) if (state.roles[k].id === id) role = state.roles[k];
      if (!role) return;
      if (!confirm("确定删除角色「" + role.name + "」？该角色下的用户将失去对应权限。")) return;
      api("/api/roles/" + id, { method: "DELETE" })
        .then(function () { toast("角色已删除"); loadRoles(); })
        .catch(fail);
      return;
    }
    if (action === "remove-permission") {
      if (!confirm("确定删除该权限？所有引用它的角色将失去此权限。")) return;
      api("/api/permissions/" + id, { method: "DELETE" })
        .then(function () { toast("权限已删除"); loadPermissions(); })
        .catch(fail);
      return;
    }
  });

  /* ---------------- tabs ---------------- */

  function switchTab(tab) {
    state.tab = tab;
    var buttons = document.querySelectorAll("#nav button");
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].className = buttons[i].getAttribute("data-tab") === tab ? "active" : "";
    }
    $("tab-users").hidden = tab !== "users";
    $("tab-roles").hidden = tab !== "roles";
    $("tab-permissions").hidden = tab !== "permissions";
    if (tab === "users") loadUsers();
    else if (tab === "roles") loadRoles();
    else if (tab === "permissions") loadPermissions();
    else if (tab === "keys") loadApiKeys();
    else if (tab === "audit") loadAuditEntries();
  }

  $("nav").addEventListener("click", function (e) {
    var tab = e.target.getAttribute && e.target.getAttribute("data-tab");
    if (tab) switchTab(tab);
  });

  /* ---------------- users ---------------- */

  function loadUsers() {
    api("/api/users?page=" + state.page + "&pageSize=" + state.pageSize + "&q=" + encodeURIComponent(state.q))
      .then(function (data) {
        state.total = data.total;
        state.users = data.users;
        renderUsers();
      })
      .catch(fail);
  }

  function totalPages() { return Math.max(1, Math.ceil(state.total / state.pageSize)); }

  function renderUsers() {
    var rows = "";
    if (!state.users.length) {
      rows = '<tr><td colspan="4" class="empty">没有找到用户</td></tr>';
    }
    for (var i = 0; i < state.users.length; i++) {
      var u = state.users[i];
      var emailCell;
      if (state.editId === u.id) {
        emailCell = '<input class="editbox" id="edit-' + esc(u.id) + '" value="' + esc(u.email) + '">' +
          ' <button class="btn small primary" data-action="save-edit-email" data-id="' + esc(u.id) + '">保存</button>' +
          ' <button class="btn small" data-action="cancel-edit-email">取消</button>';
      } else {
        emailCell = esc(u.email);
      }
      rows += "<tr>" +
        "<td>" + emailCell + "</td>" +
        "<td>" + roleChips(u.roles) + "</td>" +
        '<td class="muted">' + esc(u.created_at) + "</td>" +
        '<td class="actions">' +
        '<button class="btn small" data-action="start-edit-email" data-id="' + esc(u.id) + '">改邮箱</button>' +
        ' <button class="btn small" data-action="open-assign" data-id="' + esc(u.id) + '">分配角色</button>' +
        ' <button class="btn small danger" data-action="remove-user" data-id="' + esc(u.id) + '">删除</button>' +
        "</td></tr>";
    }
    $("tab-users").innerHTML =
      '<div class="card">' +
      '<div class="toolbar">' +
      '<input type="text" id="search" placeholder="按邮箱搜索" value="' + esc(state.q) + '">' +
      '<button class="btn" data-action="do-search">搜索</button>' +
      '<span class="count">共 ' + state.total + " 位用户</span>" +
      "</div>" +
      "<table><thead><tr><th>邮箱</th><th>角色</th><th>创建时间</th><th></th></tr></thead><tbody>" + rows + "</tbody></table>" +
      '<div class="pager">' +
      '<button class="btn small" data-action="goto-page" data-delta="-1"' + (state.page <= 1 ? " disabled" : "") + ">上一页</button>" +
      '<span class="muted">第 ' + state.page + " / " + totalPages() + " 页</span>" +
      '<button class="btn small" data-action="goto-page" data-delta="1"' + (state.page >= totalPages() ? " disabled" : "") + ">下一页</button>" +
      "</div></div>";
  }


  function openAssign(id) {
    var user = null;
    for (var i = 0; i < state.users.length; i++) if (state.users[i].id === id) user = state.users[i];
    if (!user) return;
    var checks = "";
    for (var j = 0; j < state.roles.length; j++) {
      var r = state.roles[j];
      var checked = user.roles.indexOf(r.name) >= 0 ? " checked" : "";
      checks += '<label><input type="checkbox" value="' + esc(r.name) + '" name="assign-role"' + checked + "> " + esc(r.name) + ' <span class="muted">' + esc(r.description) + "</span></label>";
    }
    openModal(
      "<h3>分配角色</h3>" +
      '<p class="muted">' + esc(user.email) + "</p>" +
      '<div class="checklist">' + checks + "</div>" +
      '<div class="footer"><button class="btn" data-action="close-modal">取消</button>' +
      '<button class="btn primary" data-action="submit-assign" data-id="' + esc(id) + '">保存</button></div>'
    );
  }

  /* ---------------- roles ---------------- */

  function loadRoles() {
    Promise.all([api("/api/roles"), api("/api/permissions")])
      .then(function (results) {
        state.roles = results[0].roles;
        state.permissions = results[1].permissions;
        renderRoles();
      })
      .catch(fail);
  }

  function renderRoles() {
    var rows = "";
    if (!state.roles.length) rows = '<tr><td colspan="5" class="empty">暂无角色</td></tr>';
    for (var i = 0; i < state.roles.length; i++) {
      var r = state.roles[i];
      var builtin = !!r.is_system;
      var permChips = r.permissions && r.permissions.length
        ? r.permissions.map(function (p) { return '<span class="chip mono">' + esc(p) + "</span>"; }).join("")
        : '<span class="muted">无</span>';
      rows += "<tr>" +
        "<td>" + esc(r.name) + "</td>" +
        '<td class="muted">' + esc(r.description) + "</td>" +
        "<td>" + permChips + "</td>" +
        '<td class="muted">' + (r.user_count || 0) + "</td>" +
        '<td class="actions">' +
        '<button class="btn small" data-action="open-role-editor" data-id="' + esc(r.id) + '">编辑</button>' +
        (builtin ? "" : ' <button class="btn small danger" data-action="remove-role" data-id="' + esc(r.id) + '">删除</button>') +
        "</td></tr>";
    }
    $("tab-roles").innerHTML =
      '<div class="card">' +
      '<div class="toolbar"><span class="count">共 ' + state.roles.length + " 个角色</span>" +
      '<span style="flex:1"></span>' +
      '<button class="btn primary" data-action="open-role-editor">新建角色</button></div>' +
      "<table><thead><tr><th>名称</th><th>描述</th><th>权限</th><th>用户数</th><th></th></tr></thead><tbody>" + rows + "</tbody></table>" +
      "</div>";
  }

  function findRole(id) {
    for (var i = 0; i < state.roles.length; i++) if (state.roles[i].id === id) return state.roles[i];
    return null;
  }

  function openRoleEditor(id) {
    var role = id ? findRole(id) : null;
    if (id && !role) return;
    var checks = "";
    for (var i = 0; i < state.permissions.length; i++) {
      var p = state.permissions[i];
      var checked = role && role.permissions && role.permissions.indexOf(p.code) >= 0 ? " checked" : "";
      checks += '<label><input type="checkbox" value="' + esc(p.code) + '" name="role-permission"' + checked + '> <span class="mono">' + esc(p.code) + '</span> <span class="muted">' + esc(p.description) + "</span></label>";
    }
    openModal(
      "<h3>" + (role ? "编辑角色" : "新建角色") + "</h3>" +
      '<label>名称</label><input type="text" id="role-name" value="' + esc(role ? role.name : "") + '">' +
      '<label>描述</label><input type="text" id="role-desc" value="' + esc(role ? role.description : "") + '">' +
      "<label>权限</label>" +
      '<div class="checklist">' + checks + "</div>" +
      '<div class="footer"><button class="btn" data-action="close-modal">取消</button>' +
      '<button class="btn primary" data-action="submit-role"' + (role ? ' data-id="' + esc(role.id) + '"' : "") + ">保存</button></div>"
    );
  }

  /* ---------------- permissions ---------------- */

  function loadPermissions() {
    api("/api/permissions")
      .then(function (data) { renderPermissions(data.permissions); })
      .catch(fail);
  }

  function renderPermissions(list) {
    var rows = "";
    if (!list.length) rows = '<tr><td colspan="3" class="empty">暂无权限</td></tr>';
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      rows += "<tr>" +
        '<td class="mono">' + esc(p.code) + "</td>" +
        '<td class="muted">' + esc(p.description) + "</td>" +
        '<td class="actions"><button class="btn small danger" data-action="remove-permission" data-id="' + esc(p.id) + '">删除</button></td>' +
        "</tr>";
    }
    $("tab-permissions").innerHTML =
      '<div class="card">' +
      '<div class="inlineform">' +
      '<input type="text" id="perm-code" class="code" placeholder="resource:action">' +
      '<input type="text" id="perm-desc" placeholder="权限描述" style="flex:1">' +
      '<button class="btn primary" data-action="add-permission">新增权限</button>' +
      "</div>" +
      "<table><thead><tr><th>权限码</th><th>描述</th><th></th></tr></thead><tbody>" + rows + "</tbody></table>" +
      "</div>";
  }


  /* ---------------- audit log ---------------- */

  function loadAuditEntries() {
    api("/api/audit").then(function (data) {
      renderAudit(data.entries);
    }).catch(fail);
  }

  function renderAudit(entries) {
    var rows = "";
    if (!entries.length) { rows = "<tr><td colspan="4" class="empty">暂无审计记录</td></tr>"; }
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      rows += "<tr><td>" + esc(e.actor_email) + "</td><td><span class="chip mono">" + esc(e.action) + "</span></td><td>" + esc(e.detail || "") + "</td><td class="muted">" + esc(e.created_at) + "</td></tr>";
    }
    $("tab-audit").innerHTML =
      "<div class="card">" +
      "<div class="toolbar"><span class="count">共 " + entries.length + " 条记录</span></div>" +
      "<table><thead><tr><th>操作人</th><th>操作</th><th>详情</th><th></th></tr><thead><tbody>" + rows + "</tbody></table></div>";
  }

  /* ---------------- boot ---------------- */


  Promise.all([api("/api/me"), api("/api/roles"), api("/api/permissions")])
    .then(function (results) {
      var me = results[0];
      state.roles = results[1].roles;
      state.permissions = results[2].permissions;
      state.me = me;
      if (!me.permissions.length) {
        document.querySelector("main").innerHTML =
          '<div class="card forbidden"><h2>没有访问权限</h2><p class="muted">当前账号 ' + esc(me.user.email) + " 不具备任何管理权限，请联系管理员分配角色。</p></div>";
        $("nav").style.display = "none";
        return;
      }
      $("whoami").textContent = me.user.email;
      switchTab("users");
    })
    .catch(function (err) {
      if (err.code === "forbidden") {
        document.querySelector("main").innerHTML =
          '<div class="card forbidden"><h2>没有访问权限</h2><p class="muted">当前账号不具备任何管理权限，请联系管理员分配角色。</p></div>';
        $("nav").style.display = "none";
        return;
      }
      document.querySelector("main").innerHTML =
        '<div class="card forbidden"><h2>加载失败</h2><p class="muted">' + esc(err.message) + "</p></div>";
      $("nav").style.display = "none";
    });
})();
