document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('searchInput');
  const resultTableBody = document.getElementById('resultTableBody');

  searchInput.addEventListener('input', () => {
    const searchTerm = searchInput.value.trim();

    if (searchTerm === '') {
      resultTableBody.innerHTML = '';
      return;
    }

    let regex;
    try {
      regex = new RegExp(searchTerm, 'i');
    } catch (e) {
      resultTableBody.innerHTML = `
        <tr>
          <td colspan="4" class="text-red-400 text-center py-4">Invalid regex pattern</td>
        </tr>`;
      return;
    }

    fetch('/data')
      .then(response => response.json())
      .then(data => {
        const filteredData = data.filter(item => regex.test(item.Description));
        resultTableBody.innerHTML = '';

        if (filteredData.length === 0) {
          resultTableBody.innerHTML = `
            <tr>
              <td colspan="4" class="text-center text-gray-400 py-4">No matching results</td>
            </tr>`;
          return;
        }

        filteredData.forEach(item => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td class="p-3">${item.Description}</td>
            <td class="p-3 material-cost-cell blurred">${item['Material Cost']}</td>
            <td class="p-3">${item.Wholesale}</td>
            <td class="p-3">${item.Retail}</td>
          `;
          resultTableBody.appendChild(row);
        });
      })
      .catch(err => {
        console.error(err);
        resultTableBody.innerHTML = `
          <tr>
            <td colspan="4" class="text-red-400 text-center py-4">Error fetching data</td>
          </tr>`;
      });
  });
});
