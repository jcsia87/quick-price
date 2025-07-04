document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const resultTableBody = document.querySelector('#resultTable tbody');

    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value;

        // Clear table if search input is empty
        if (searchTerm.trim() === '') {
            resultTableBody.innerHTML = '';
            return;
        }

        let regex;
        try {
            regex = new RegExp(searchTerm, 'i'); // 'i' for case-insensitive
        } catch (e) {
            resultTableBody.innerHTML = `<tr><td colspan="4" style="color:red;">Invalid regex pattern</td></tr>`;
            return;
        }

        fetch('/data')
            .then(response => response.json())
            .then(data => {
                const filteredData = data.filter(item => regex.test(item.Description));

                resultTableBody.innerHTML = '';
                filteredData.forEach(item => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${item.Description}</td>
                        <td>${item['Material Cost']}</td>
                        <td>${item.Wholesale}</td>
                        <td>${item.Retail}</td>
                    `;
                    resultTableBody.appendChild(row);
                });
            });
    });
});
