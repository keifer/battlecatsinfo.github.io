import {config, toggleTheme, resetTheme} from './common.mjs';
import {loadAllCats} from './unit.mjs';

let my_stars_list = [];

function onSidebarAnchorClick(event) {
	for (const node of document.getElementsByClassName('focus'))
		node.classList.remove('focus');
	event.currentTarget.classList.add('focus');
}

function onTabLinkClick(event) {
	const tabElem = event.currentTarget;
	const targetId = tabElem.value;
	for (const elem of document.getElementsByClassName("treasure"))
		elem.hidden = true;
	document.getElementById(targetId).hidden = false;
	for (const elem of document.getElementsByClassName("tablink"))
		elem.classList.remove('atab');
	tabElem.classList.add("atab");
}

function onStarCatDeleteClick(event) {
	event.preventDefault();
	const tr = event.target.parentNode.parentNode;
	const id = parseInt(tr.children[0].children[0].innerText.slice(1));
	my_stars_list = my_stars_list.filter(x => x.id != id);
	config.starCats = my_stars_list;
	tr.remove();
	return false;
}

function onSettingChange(event) {
	const elem = event.currentTarget;
	const name = elem.name;
	const value = elem.value;

	if (!elem.validity.valid) {
		return;
	}

	// special handling of treasures
	if (name.startsWith('t$')) {
		const idx = parseInt(name.slice(2));
		config.setTreasure(idx, value);
		return;
	}

	// special handling to switch the color theme immediately
	if (name === 'theme') {
		if (value)
			toggleTheme(value);
		else
			resetTheme();
		return;
	}

	if (!(name in config)) {
		throw new Error(`Missing handler for setting: ${name}`);
	}
	config[name] = value;
}

function updateStarCatsDisplay() {
	const my_stars = document.getElementById('my-stars');
	// Clear existing rows (keep header)
	while (my_stars.children.length > 1) {
		my_stars.removeChild(my_stars.lastChild);
	}
	
	my_stars_list = config.starCats;
	if (!my_stars_list.length) {
		my_stars.parentNode.innerHTML = '<p>你還沒有收藏的貓咪，在貓咪檢視畫面按下「★加入我的最愛」或貓咪圖鑑收藏貓咪。</p><table id="my-stars" class="w3-table w3-striped w3-centered"><tr><td>ID</td><td>圖示</td><td>名稱</td><td>動作</td></tr></table>';
		document.getElementById('my-stars').parentNode.innerHTML = document.getElementById('my-stars').parentNode.innerHTML;
	} else {
		for (let cat of my_stars_list) {
			const tr = my_stars.appendChild(document.createElement('tr'));
			const td1 = tr.appendChild(document.createElement('td'));
			const a = td1.appendChild(document.createElement('a'));
			a.href = './unit.html?id=' + cat.id;
			a.innerText = `#${cat.id}`;
			const td2 = tr.appendChild(document.createElement('td'));
			const a2 = td2.appendChild(document.createElement('a'));
			a2.href = a.href;
			const img = a2.appendChild(new Image());
			img.src = cat.icon;
			const td3 = tr.appendChild(document.createElement('td'));
			td3.innerText = cat.name;
			const td4 = tr.appendChild(document.createElement('td'));
			const a3 = td4.appendChild(document.createElement('a'));
			a3.innerText = '移除';
			a3.style.setProperty('color', '#ff5722', 'important');
			a3.style.cursor = 'pointer';
			a3.onclick = onStarCatDeleteClick;
		}
	}
}

function onUserChange(event) {
	const newUser = event.target.value;
	config.currentUser = newUser;
	updateStarCatsDisplay();
}

function onNewUserClick(event) {
	event.preventDefault();
	const newUserName = prompt('請輸入新使用者名稱：');
	if (newUserName && newUserName.trim()) {
		config.currentUser = newUserName.trim();
		const userSelect = document.getElementById('user-select');
		
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
		updateStarCatsDisplay();
	}
	return false;
}

function onViewHistoryClick(event) {
	event.preventDefault();
	const history = config.getStarCatsHistory();
	const historyContainer = document.getElementById('history-container');
	const historyTable = document.getElementById('history-table');
	
	// Clear existing rows (keep header)
	while (historyTable.children.length > 1) {
		historyTable.removeChild(historyTable.lastChild);
	}
	
	if (history.length === 0) {
		historyContainer.style.display = 'block';
		const tr = historyTable.appendChild(document.createElement('tr'));
		const td = tr.appendChild(document.createElement('td'));
		td.colSpan = 3;
		td.textContent = '暫無變動紀錄';
	} else {
		historyContainer.style.display = 'block';
		for (const record of history) {
			const tr = historyTable.appendChild(document.createElement('tr'));
			const td1 = tr.appendChild(document.createElement('td'));
			td1.textContent = new Date(record.timestamp).toLocaleString('zh-TW');
			
			const td2 = tr.appendChild(document.createElement('td'));
			if (record.added.length > 0) {
				td2.textContent = record.added.map(c => `${c.name}(#${c.id})`).join('、');
			} else {
				td2.textContent = '-';
			}
			
			const td3 = tr.appendChild(document.createElement('td'));
			if (record.removed.length > 0) {
				td3.textContent = record.removed.map(c => `${c.name}(#${c.id})`).join('、');
			} else {
				td3.textContent = '-';
			}
		}
	}
	return false;
}

function generateMarkdownReport() {
	const allUsersData = config.getAllUsersStarCats();
	const users = Object.keys(allUsersData);
	
	let markdown = '# 我的最愛清單報告\n\n';
	markdown += `**生成時間**: ${new Date().toLocaleString('zh-TW')}\n\n`;
	
	markdown += '## 使用者總覽\n\n';
	markdown += '| 使用者 | 最愛數量 |\n';
	markdown += '|------|-------|\n';
	
	for (const user of users) {
		const cats = allUsersData[user];
		markdown += `| ${user} | ${cats.length} |\n`;
	}
	
	markdown += '\n## 詳細清單\n\n';
	
	for (const user of users) {
		const cats = allUsersData[user];
		markdown += `### ${user}\n\n`;
		
		if (cats.length === 0) {
			markdown += '*該使用者暫無最愛清單*\n\n';
			continue;
		}
		
		markdown += '| ID | 名稱 | 圖示 |\n';
		markdown += '|-------|-------|----------|\n';
		
		for (const cat of cats) {
			markdown += `| #${cat.id} | ${cat.name} | ![${cat.name}](${cat.icon}) |\n`;
		}
		
		markdown += '\n### ' + user + ' 的變動紀錄\n\n';
		
		// Get history for this user
		const historyKey = `star-cats-history-${user}`;
		const historyStr = localStorage.getItem(historyKey);
		let history = [];
		if (historyStr) {
			try {
				history = JSON.parse(historyStr);
			} catch (e) {
				history = [];
			}
		}
		
		if (history.length === 0) {
			markdown += '*暫無變動紀錄*\n';
		} else {
			markdown += '| 時間 | 新增 | 移除 |\n';
			markdown += '|------|------|------|\n';
			
			for (const record of history) {
				const time = new Date(record.timestamp).toLocaleString('zh-TW');
				const added = record.added.length > 0 ? record.added.map(c => `${c.name}(#${c.id})`).join('、') : '-';
				const removed = record.removed.length > 0 ? record.removed.map(c => `${c.name}(#${c.id})`).join('、') : '-';
				markdown += `| ${time} | ${added} | ${removed} |\n`;
			}
		}
		
		markdown += '\n';
	}
	
	return markdown;
}

function onExportHistoryClick(event) {
	event.preventDefault();
	const markdown = generateMarkdownReport();
	const element = document.createElement('a');
	element.setAttribute('href', 'data:text/markdown;charset=utf-8,' + encodeURIComponent(markdown));
	element.setAttribute('download', `貓咪最愛清單報告_${new Date().toISOString().slice(0,10)}.md`);
	element.style.display = 'none';
	document.body.appendChild(element);
	element.click();
	document.body.removeChild(element);
	return false;
}

// Initialize sidebar
for (const elem of document.querySelectorAll('.w3-sidebar a[href]')) {
	elem.addEventListener('click', onSidebarAnchorClick);
}

// Initialize treasure tabs
for (const elem of document.getElementsByClassName('tablink')) {
	elem.addEventListener('click', onTabLinkClick);
}

// Initialize settings form
for (const elem of document.getElementById('settings').elements) {
	if (!elem.name) { continue; }
	elem.addEventListener('change', onSettingChange);

	// init value
	const name = elem.name;
	let value;
	if (name.startsWith('t$')) {
		const idx = parseInt(name.slice(2));
		value = config.getTreasure(idx);
	} else if (name === 'theme') {
		value = config.colorTheme;
	} else {
		value = config[name];
	}

	if (elem.type === 'radio')
		elem.checked = elem.value == value;
	else
		elem.value = value;
}

// Initialize user selector
const userSelect = document.getElementById('user-select');
const btnNewUser = document.getElementById('btn-new-user');
const btnViewHistory = document.getElementById('btn-view-history');
const btnExportHistory = document.getElementById('btn-export-history');

if (userSelect) {
	userSelect.value = config.currentUser;
	userSelect.addEventListener('change', onUserChange);
}

if (btnNewUser) {
	btnNewUser.addEventListener('click', onNewUserClick);
}

if (btnViewHistory) {
	btnViewHistory.addEventListener('click', onViewHistoryClick);
}

if (btnExportHistory) {
	btnExportHistory.addEventListener('click', onExportHistoryClick);
}

// Display favorite cats
updateStarCatsDisplay();
