document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const resultTableBody = document.querySelector('#resultTable tbody');

    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.toLowerCase();

        // If the input is empty, clear the table
        if (searchTerm === '') {
            resultTableBody.innerHTML = '';
            return;
        }

        fetch('/data')
            .then(response => response.json())
            .then(data => {
                const filteredData = data.filter(item => item.Description.toLowerCase().includes(searchTerm));

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
