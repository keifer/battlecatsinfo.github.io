import {config, numStr, numStrT, round, pagination} from './common.mjs';
import {loadAllCats} from './unit.mjs';

// Expose config to global scope for console debugging
window.config = config;

var cats;
var cats_old;
var hide_search = false;  // Show search filters by default
var last_forms;
var form_s = 0;  // Default to show all forms
var per_page = 9999;  // Default to show all items per page
let def_lv;
let plus_lv;
let display_forms;

const ori_expr = document.getElementById('ori-expr');
const filter_expr = document.getElementById("filter-expr");
const sort_expr = document.getElementById("sort-expr");
const search_result = document.getElementById("search-result");
const tbody = document.getElementById("tbody");
const pages_a = document.getElementById("pages-a");
const tables = document.getElementById("tables");
const toggle_s = document.getElementById("toggle-s");
const only_my_fav = document.getElementById("only-my-fav");
const def_lv_e = document.getElementById("def-lv");
const plus_lv_e = document.getElementById("plus-lv");
const cattype_e = document.getElementById("cattype");
const trait_s = document.getElementById("trait-s");
const atk_s = document.getElementById("atk-s");
const ab_s = document.getElementById("ab-s");
const atkBtn = atk_s.firstElementChild.firstElementChild;
const traitBtn = trait_s.firstElementChild.firstElementChild;
const abBtn = ab_s.firstElementChild.firstElementChild;
const name_search = document.getElementById("name-search");

// User management elements
const userSelect = document.getElementById('user-select');
const btnNewUser = document.getElementById('btn-new-user');
const currentUserDisplay = document.getElementById('current-user-display');

// Update user display
function updateUserDisplay() {
	const user = config.currentUser;
	const favCount = config.starCats.length;
	currentUserDisplay.textContent = `[${user}] ⭐${favCount}`;
}

// User change handler
function onUserChange(event) {
	const newUser = event.target.value;
	config.currentUser = newUser;
	updateUserDisplay();
	// Automatically recalculate with favorites filter after user change
	only_my_fav.checked = true;
	document.getElementById('per_page').value = '9999';
	per_page = 9999;
	applyFavoritesFilter(false);  // Apply filter without showing alert
	calculate('dps', true);
}

// New user handler
function onNewUserClick(event) {
	event.preventDefault();
	const newUserName = prompt('請輸入新使用者名稱：');
	if (newUserName && newUserName.trim()) {
		config.currentUser = newUserName.trim();
		
		// Add new option if not exists
		let optionExists = false;
		for (let option of userSelect.options) {
			if (option.value === newUserName.trim()) {
				optionExists = true;
				break;
			}
		}
		if (!optionExists) {
			const newOption = document.createElement('option');
			newOption.value = newUserName.trim();
			newOption.textContent = newUserName.trim();
			userSelect.appendChild(newOption);
		}
		
		userSelect.value = newUserName.trim();
		updateUserDisplay();
		renderTable(last_forms);
	}
	return false;
}

// Star button click handler
function onStarButtonClick(form, starBtn) {
	const starCats = config.starCats;
	const catIndex = starCats.findIndex(c => c.id === form.id);
	
	if (catIndex >= 0) {
		// Remove from favorites
		starCats.splice(catIndex, 1);
		starBtn.textContent = '☆';
		starBtn.title = '加入最愛';
	} else {
		// Add to favorites
		starCats.push({
			id: form.id,
			name: form.name || form.jp_name,
			icon: form.icon
		});
		starBtn.textContent = '⭐';
		starBtn.title = '從最愛中移除';
	}
	
	config.starCats = starCats;
	updateUserDisplay();
}

function rerender(page) {
	const url = new URL(location.href);
	url.searchParams.set("page", page);
	if (location.href != url.href)
		history.pushState({}, "", url);
	renderTable(last_forms, page);
}

function onPagerClick(event) {
	event.preventDefault();
	rerender(event.currentTarget._i);
}

document.getElementById('per_page').oninput = function setRange(e) {
	per_page = parseInt(e.currentTarget.value);
	const url = new URL(location.href);
	if (per_page != 10) {
		url.searchParams.set('per', per_page);
	} else {
		url.searchParams.delete('per');
	}
	history.pushState({}, '', url);
	renderTable(last_forms);
};

function filterByNameOrId(results) {
	const key = name_search.value.toLowerCase().trim();
	if (!key)
		return results;
	const qid = /^\d+$/.test(key) ? parseInt(key, 10) : null;

	if (form_s === 0) {
		return results.filter(result => {
			const f = result[1];
			return (f.id === qid) || f.name.toLowerCase().includes(key) || f.jp_name.toLowerCase().includes(key);
		});
	}

	const cats = new Set(results.map(r => r[1].base));
	for (const cat of cats) {
		if (!(
			cat.id === qid ||
			cat.forms.some(f => f.name.toLowerCase().includes(key) || f.jp_name.toLowerCase().includes(key))
		)) {
			cats.delete(cat);
		}
	}
	return results.filter(r => cats.has(r[1].base));
}

function renderTable(forms, page = 1) {
	last_forms = forms;
	forms = filterByNameOrId(forms);
	
	// Group forms by base cat (主ID) and keep highest sort value
	const groupedByBaseCat = new Map();
	for (const [sortValue, form] of forms) {
		const baseCat = form.base;
		const baseId = baseCat.id;
		
		if (!groupedByBaseCat.has(baseId)) {
			groupedByBaseCat.set(baseId, {
				baseCat: baseCat,
				forms: [],
				maxSortValue: sortValue
			});
		}
		
		const group = groupedByBaseCat.get(baseId);
		group.forms.push(form);
		group.maxSortValue = Math.max(group.maxSortValue, sortValue);
	}
	
	// Convert to array and sort by maxSortValue
	const groupedForms = Array.from(groupedByBaseCat.values())
		.sort((a, b) => b.maxSortValue - a.maxSortValue);
	
	var H = per_page * page;
	display_forms = groupedForms.slice(H - per_page, H);
	tbody.textContent = "";
	search_result.textContent = `顯示第${H - per_page + 1}到第${Math.min(groupedForms.length, H)}個結果，共有${groupedForms.length}個結果`;

	if (0 == groupedForms.length) {
		tbody.innerHTML = '<tr><td colSpan="14">沒有符合條件的貓咪！</td></tr>';
		return;
	}

	pages_a.textContent = '';
	for (const c of pagination({
		page,
		max: Math.ceil(groupedForms.length / per_page),
	})) {
		const td = pages_a.appendChild(document.createElement("td"));
		td.textContent = c;
		td._i = c;
		if (page == c) {
			td.classList.add("N");
		} else {
			td.onclick = onPagerClick;
		}
	}

	// Get current user's favorite cats
	const starCats = config.starCats;
	
	for (let i = 0; i < display_forms.length; ++i) {
		const tr = tbody.appendChild(document.createElement("tr"));
		const group = display_forms[i];
		const baseCat = group.baseCat;
		
		// Sort forms by lvc to ensure correct order
		group.forms.sort((a, b) => a.lvc - b.lvc);
		const highestForm = group.forms[group.forms.length - 1]; // Highest form
		
		// Column 0: ID (only main ID, no sub-form number)
		const idTd = tr.appendChild(document.createElement("td"));
		idTd.textContent = baseCat.id;
		
		// Column 1: Level
		const lvTd = tr.appendChild(document.createElement("td"));
		lvTd.textContent = `Lv ${highestForm.baseLv} + ` + highestForm.plusLv;
		
		// Column 2: Icons (all forms)
		const iconsTd = tr.appendChild(document.createElement("td"));
		iconsTd.style.textAlign = 'center';
		iconsTd.style.padding = '4px';
		iconsTd.style.verticalAlign = 'middle';
		
		for (const form of group.forms) {
			const a = document.createElement("a");
			a.href = "./unit.html?id=" + form.id.toString();
			a.style.display = 'inline-block';
			a.style.marginRight = '4px';
			const img = document.createElement("img");
			img.src = form.icon;
			img.style.maxWidth = '80px';
			img.style.maxHeight = '65px';
			img.title = form.name || form.jp_name;
			a.appendChild(img);
			iconsTd.appendChild(a);
		}
		
		// Column 3: Names (all forms) - max 3 lines
		const namesTd = tr.appendChild(document.createElement("td"));
		namesTd.style.textAlign = 'center';
		namesTd.style.fontSize = '18px';
		namesTd.style.padding = '4px';
		namesTd.style.verticalAlign = 'middle';
		namesTd.style.maxHeight = '74px';
		namesTd.style.overflow = 'hidden';
		
		const nameSpans = [];
		for (const form of group.forms) {
			if (form.name) {
				const span = document.createElement("span");
				span.textContent = form.name;
				span.style.display = 'block';
				span.style.lineHeight = '1.3';
				nameSpans.push(span);
				namesTd.appendChild(span);
			}
		}
		
		// Columns 4-12: Stats (using highest form)
		const texts = [highestForm.hp, highestForm.atkm, round(highestForm.dps), highestForm.kb, highestForm.range, numStrT(highestForm.attackF), highestForm.speed, numStr(highestForm.price), numStr(group.maxSortValue)];
		for (let j = 0; j < 9; ++j) {
			const e = tr.appendChild(document.createElement("td"));
			e.textContent = texts[j].toString();
		}
		
		// Column 13: Star button for favorites (use highest form ID for favorites tracking)
		const starTd = tr.appendChild(document.createElement("td"));
		const isFav = starCats.some(c => c.id === highestForm.id);
		const starBtn = starTd.appendChild(document.createElement("button"));
		starBtn.style.border = 'none';
		starBtn.style.background = 'none';
		starBtn.style.cursor = 'pointer';
		starBtn.style.fontSize = '20px';
		starBtn.style.padding = '0';
		starBtn.textContent = isFav ? '⭐' : '☆';
		starBtn.title = isFav ? '從最愛中移除' : '加入最愛';
		starBtn.onclick = (e) => {
			e.preventDefault();
			onStarButtonClick(highestForm, starBtn);
		};
	}
}

function simplify(code) {
	return code.replaceAll("\n", "").replaceAll(" ", "").replaceAll("\r", "").replaceAll("\t", "");
}

function calculate(code = "", noUpdateUrl) {
	const sortCode = simplify(sort_expr.value);
	def_lv = Math.min(Math.max(parseInt(def_lv_e.value), 1), 60);
	plus_lv = Math.min(Math.max(parseInt(plus_lv_e.value), 0), 90);
	def_lv_e.value = def_lv;
	plus_lv_e.value = plus_lv;
	const url = new URL(location.pathname, location.href);
	if (code.length) {
		url.searchParams.set("filter", code);
	} else {
		const codes = [],
			cattypes = Array.from(cattype_e.querySelectorAll(".o-selected"));
		if (cattypes.length) {
			let M = cattypes.map(x => x.getAttribute("data-expr"));
			url.searchParams.set("cattypes", M.join(" ")), codes.push(M.join("||"));
		}
		const traits = Array.from(trait_s.querySelectorAll(".o-selected"));
		if (traits.length) {
			let M = traits.map(x => x.getAttribute("data-expr"));
			url.searchParams.set("traits", M.join(" ")), "OR" == traitBtn.textContent ? codes.push(M.join("||")) : codes.push(M.join("&&"));
		}
		const atks = Array.from(atk_s.querySelectorAll(".o-selected"));
		if (atks.length) {
			let M = atks.map(x => x.getAttribute("data-expr"));
			url.searchParams.set("atks", M.join(" ")), "OR" == atkBtn.textContent ? codes.push(M.join("||")) : codes.push(M.join("&&"));
		}
		const abs = Array.from(ab_s.querySelectorAll(".o-selected"));
		if (abs.length) {
			let M = abs.map(x => x.getAttribute("data-expr"));
			url.searchParams.set("abs", M.join(" ")), "OR" == abBtn.textContent ? codes.push(M.join("||")) : codes.push(M.join("&&"));
		}
		ori_expr.value = code = codes.length ? codes.map(x => `(${x})`).join("&&") : "1";
	}
	var results = [],
		pcode;
	try {
		pcode = pegjs.parse(code);
	} catch (ex) {
		alert(`篩選表達式錯誤: ${ex}`);
		throw ex;
	}
	let f = eval(`form => (${pcode})`);

	switch (form_s) {
		case 0:
			for (const c of cats) {
				results.push(...c.forms);
			}
			break;
		case 1:
		case 2:
		case 3:
		case 4:
			for (const c of cats) {
				const F = c.forms[form_s - 1];
				F && results.push(F);
			}
			break;
		case 5:
			for (const c of cats) {
				const F = c.forms[c.forms.length - 1];
				results.push(F);
			}
			break;
	}

	try {
		results = results.filter(form => {
			form.baseLv = def_lv;
			form.plusLv = plus_lv;
			return f(form);
		});
	} catch (ex) {
		alert(`篩選錯誤: ${ex}`);
		throw ex;
	}

	try {
		pcode = pegjs.parse(sortCode || "1");
	} catch (ex) {
		alert(`排序表達式錯誤: ${ex}`);
		throw ex;
	}
	let fn = eval(`form => (${pcode})`);
	try {
		results = results.map((form, i) => {
			let c = cats_old[form.id];
			var x = fn(form);
			return [isFinite(x) ? x : 0, form];
		}).sort((a, b) => b[0] - a[0]);
	} catch (ex) {
		alert(`排序錯誤: ${ex}`);
		throw ex;
	}
	renderTable(results);
	if (def_lv != 50) // Lv50 (default)
		url.searchParams.set("deflv", def_lv); // base level
	if (plus_lv) // +0 (default)
		url.searchParams.set("pluslv", plus_lv); // plus level
	if (sortCode.length && sortCode != '1')
		url.searchParams.set("sort", sortCode); // sort expression
	const a = "OR" == atkBtn.textContent ? "1" : "0";
	const b = "OR" == traitBtn.textContent ? "1" : "0";
	const c = "OR" == abBtn.textContent ? "1" : "0";
	const ao = a + b + c;
	if (ao != '000') // AND/AND/AND (default)
		url.searchParams.set("ao", ao); // AND/OR switch
	if (form_s != 5) // highest (default)
		url.searchParams.set('form', form_s); // all/first form/envolved/true form/highest
	if (per_page != 10) // 10 result per page (default)
		url.searchParams.set('per', per_page); // num results per page
	if (location.href != url.href && !noUpdateUrl)
		history.pushState({}, "", url);
}

function addBtns(parent, s) {
	if (s) {
		var c;
		s.split(" ");
		for (c of parent.querySelectorAll("button")) s.includes(c.parentNode.getAttribute("data-expr")) && c.parentNode.classList.add("o-selected");
	}
}

loadAllCats().then(_cats => {
	cats_old = cats = _cats;

	const params = new URLSearchParams(location.search);

	document.getElementById('loader').style.display = 'none';
	document.getElementById('main').style.display = 'block';

	for (let i = 0, I = cats_old.length; i < I; ++i) {
		const cat = cats_old[i];
		for (let j = 2, J = cat.forms.length; j < J; ++j) {
			const TF = cat.forms[j];
			if (!TF?.talents) { break; }
			TF.applyAllTalents();
		}
	}
	let Q = params.get('q');
	if (Q) {
		plus_lv = 0;
		def_lv = 50;
		name_search.value = Q;
	}
	const filter = params.get('filter');
	const sort = params.get('sort');
	if (filter)
		filter_expr.value = filter;
	if (sort)
		sort_expr.value = sort;
	const ao = params.get('ao');
	if (ao) {
		atkBtn.textContent = ao[0] == '1' ? 'OR' : 'AND';
		traitBtn.textContent = ao[1] == '1' ? 'OR' : 'AND';
		abBtn.textContent = ao[2] == '1' ? 'OR' : 'AND';
	}
	addBtns(cattype_e, params.get("cattypes"));
	addBtns(atk_s, params.get("atks"));
	addBtns(ab_s, params.get("abs"));
	addBtns(trait_s, params.get("traits"));
	Q = params.get('form');
	if (Q) {
		Q = parseInt(Q);
		if (isFinite(Q) && Q >= 0 && Q <= 5) {
			form_s = parseInt(Q);
			document.getElementById('form-s').selectedIndex = Q;
		}
	}
	Q = params.get('per');
	if (Q) {
		Q = parseInt(Q);
		if (isFinite(Q) && Q > 0) {
			per_page = Q;
			document.getElementById('per_page').value = Q;
		}
	}
	// Set default preferences
	// 1. Set default theme to light mode
	config.colorTheme = 'light';
	document.documentElement.classList.remove('dark');
	
	// 2. Set default sort to DPS
	sort_expr.value = 'dps';
	
	// 3. Set default to show only favorites
	only_my_fav.checked = true;
	
	// 4. Set default page display to "All"
	document.getElementById('per_page').value = '9999';
	per_page = 9999;
	
	// 5. Show search bar and filters by default
	document.documentElement.style.setProperty("--mhide", "block");
	document.getElementById('tables').style.left = "360px";
	document.getElementById('tables').style.width = "calc(100% - 400px)";
	hide_search = false;
	toggle_s.textContent = "隱藏搜尋器";  // Set initial toggle button text
	
	// Apply favorites filter with initialization (no alert)
	applyFavoritesFilter(false);
	calculate('dps', true);
	Q = params.get('page');
	if (Q) {
		Q = parseInt(Q);
		if (isFinite(Q) && Q > 1) {
			rerender(Q);
		}
	}

	// Initialize user management - populate user list dynamically
	// Get all users from localStorage and populate the select dropdown
	const allUsers = config.getUsers();
	const existingValues = new Set();
	
	// Collect existing option values
	for (let option of userSelect.options) {
		existingValues.add(option.value);
	}
	
	// Add any users from localStorage that aren't already in the dropdown
	for (const user of allUsers) {
		if (!existingValues.has(user)) {
			const newOption = document.createElement('option');
			newOption.value = user;
			newOption.textContent = user;
			userSelect.appendChild(newOption);
		}
	}
	
	// Set current user
	userSelect.value = config.currentUser;
	updateUserDisplay();
	userSelect.addEventListener('change', onUserChange);
	btnNewUser.addEventListener('click', onNewUserClick);
});

document.querySelectorAll("button").forEach(elem => {
	elem.state = "0";
	elem.addEventListener("click", function(event) {
		const elem = event.currentTarget;
		if ("0" == elem.state) {
			elem.parentNode.classList.add("o-selected");
			elem.state = "1"
		} else {
			elem.parentNode.classList.remove("o-selected");
			elem.state = "0";
		}
		calculate();
	});
});
document.querySelectorAll(".or-and").forEach(e => {
	e.onclick = function(event) {
		const elem = event.currentTarget;
		elem.textContent = ("OR" == elem.textContent) ? "AND" : "OR";
		calculate();
	};
});
document.getElementById("filter-go").onclick = function() {
	calculate(simplify(filter_expr.value));
};
document.getElementById("filter-clear").onclick = function() {
	function fn(x) {
		x.classList.remove("o-selected");
	}
	cattype_e.querySelectorAll(".o-selected").forEach(fn);
	trait_s.querySelectorAll(".o-selected").forEach(fn);
	atk_s.querySelectorAll(".o-selected").forEach(fn);
	ab_s.querySelectorAll(".o-selected").forEach(fn);
	ori_expr.value = "";
	filter_expr.value = "";
	sort_expr.value = "";
	calculate();
};

// Apply favorites filter - extracted into separate function for reuse
function applyFavoritesFilter(showAlert = false) {
	let favs;
	if (only_my_fav.checked) {
		favs = config.starCats;
		if (!favs.length) {
			if (showAlert) {
				alert('我的最愛裡還沒有貓咪！\n可以去貓咪資訊裡加入我的最愛或用貓咪圖鑑管理！');
			}
			only_my_fav.checked = false;
			cats = cats_old;
		} else {
			favs = favs.map(x => cats_old[x.id]);
			cats = favs;
		}
	} else {
		cats = cats_old;
	}
}

only_my_fav.onchange = function() {
	applyFavoritesFilter(true);
	calculate(simplify(ori_expr.value));
};
toggle_s.onclick = function() {
	if (hide_search) {
		tables.style.left = "360px";
		tables.style.width = "calc(100% - 400px)";
		document.documentElement.style.setProperty("--mhide", "block");
		toggle_s.textContent = "隱藏搜尋器";
	} else {
		document.documentElement.style.setProperty("--mhide", "none");
		tables.style.left = "0px";
		tables.style.width = "100%";
		toggle_s.textContent = "顯示搜尋器";
	}
	hide_search = !hide_search;
};
name_search.oninput = function() {
	renderTable(last_forms);
};
document.getElementById('form-s').onchange = function() {
	form_s = this.selectedIndex;
	calculate(simplify(ori_expr.value));
};
const th = document.getElementById('th');
for (let n of th.children) {
	if (n.title) {
		n._s = 0;
		n._t = n.textContent;
		n.onclick = function(event) {
			if (n._s == 0) {
				n._s = 1;
				sort_expr.value = event.currentTarget.title;
			} else {
				n._s = 0;
				sort_expr.value = '-' + event.currentTarget.title;
			}
			let y = n._s;
			for (let x of th.children) {
				if (x.title) {
					x.textContent = x._t;
					x._s = 0;
				}
			}
			n._s = y;
			n.textContent = n._t + (n._s ? '↑' : '↓');
			calculate(simplify(ori_expr.value));
		}
	}
}
