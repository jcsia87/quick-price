document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const multiplierInput = document.getElementById('multiplierInput');
    const resultTableBody = document.querySelector('#resultTable tbody');

    let multiplier = 1;

    multiplierInput.addEventListener('input', () => {
        const value = parseFloat(multiplierInput.value);
        multiplier = isNaN(value) ? 1 : value;
        searchInput.dispatchEvent(new Event('input'));
    });

    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.toLowerCase();

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
                    const retail = parseFloat(item.Retail);
                    const markedUp = isNaN(retail)
                        ? ''
                        : (retail * multiplier) % 1 === 0
                            ? (retail * multiplier).toFixed(0)
                            : (retail * multiplier).toFixed(2);

                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${item.Description}</td>
                        <td>${item['Material Cost']}</td>
                        <td>${item.Wholesale}</td>
                        <td>${item.Retail}</td>
                        <td>${markedUp}</td>
                    `;
                    resultTableBody.appendChild(row);
                });
            });
    });
});
