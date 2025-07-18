let isBlurred = true;

function toggleBlur() {
  const cells = document.querySelectorAll('.material-cost-cell');
  const icon = document.getElementById('eyeIcon');
  isBlurred = !isBlurred;

  cells.forEach(cell => {
    cell.classList.toggle('blurred', isBlurred);
  });

  icon.classList.remove('fa-eye', 'fa-eye-slash');
  icon.classList.add(isBlurred ? 'fa-eye-slash' : 'fa-eye');
}

function showMainUI() {
  document.getElementById('loginForm').classList.add('hidden');
  document.getElementById('mainUI').classList.remove('hidden');
  document.getElementById('loginError').classList.add('hidden'); // Clear error
}

function showLogin() {
  document.getElementById('loginForm').classList.remove('hidden');
  document.getElementById('mainUI').classList.add('hidden');
  document.getElementById('loginError').classList.add('hidden'); // Clear error
}

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const passwordInput = document.getElementById('password');
  const loginError = document.getElementById('loginError');
  const searchInput = document.getElementById('searchInput');
  const resultTableBody = document.getElementById('resultTableBody');

  // Hide both UIs and error initially
  document.getElementById('loginForm').classList.add('hidden');
  document.getElementById('mainUI').classList.add('hidden');
  loginError.classList.add('hidden');

  // Check auth status on load
  fetch('/check-auth', { credentials: 'include' })
    .then(res => res.json())
    .then(data => {
      if (data.authenticated) {
        showMainUI();
      } else {
        showLogin();
      }
    });

  loginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    loginError.classList.add('hidden'); // Always hide error before login attempt
    fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: passwordInput.value }),
      credentials: 'include' // <-- send cookies
    })
      .then(res => {
        if (!res.ok) throw new Error('Invalid password');
        return res.json();
      })
      .then(data => {
        if (data.success) {
          showMainUI();
          loginError.classList.add('hidden');
        } else {
          loginError.textContent = data.message || 'Login failed';
          loginError.classList.remove('hidden');
        }
      })
      .catch(() => {
        loginError.textContent = 'Invalid password';
        loginError.classList.remove('hidden');
      });
  });

  // Debounce function
  function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  function handleSearch() {
    const searchTerm = searchInput.value.trim();

    if (searchTerm === '') {
      resultTableBody.innerHTML = '';
      return;
    }


    fetch(`/data?search=${encodeURIComponent(searchTerm)}`, { credentials: 'include' })
      .then(response => {
        if (!response.ok) throw new Error('Unauthorized');
        return response.json();
      })
      .then(data => {
        resultTableBody.innerHTML = '';

        if (data.length === 0) {
          resultTableBody.innerHTML = `
            <tr>
              <td colspan="4" class="text-center text-gray-400 py-4">No matching results</td>
            </tr>`;
          return;
        }

        data.forEach(item => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td class="p-3">${item.Description || ''}</td>
            <td class="p-3 material-cost-cell ${isBlurred ? 'blurred' : ''}">${item['Material Cost'] || ''}</td>
            <td class="p-3">${item.Wholesale || ''}</td>
            <td class="p-3">${item.Retail || ''}</td>
          `;
          resultTableBody.appendChild(row);
        });
      })
      .catch(err => {
        if (err.message === 'Unauthorized') {
          showLogin();
          loginError.textContent = 'Session expired. Please log in again.';
          loginError.classList.remove('hidden');
        } else {
          resultTableBody.innerHTML = `
            <tr>
              <td colspan="4" class="text-red-400 text-center py-4">Error fetching data</td>
            </tr>`;
        }
      });
  }

  searchInput.addEventListener('input', debounce(handleSearch, 300));
});
