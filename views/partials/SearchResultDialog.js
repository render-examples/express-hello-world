exports.searchResultDialog = (resultsHtml) => {
    return `
        <div id="search-results-dialog">
            <div id="search-results-content">
                <a id="search-results-close-button">x</a>
                <h5>Search Results</h5>
                <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                    ${resultsHtml}
                </div>
            </div>
        </div>
        <script>
            try {
                const myDialog = document.getElementById('search-results-dialog');
                const closeButton = document.getElementById('search-results-close-button');
                document.addEventListener('click', (e) => {
                    const dialogClicked = myDialog.contains(e.target);
                    if(!dialogClicked) {
                        myDialog.classList.add('d-none');
                    }
                });
                closeButton.addEventListener('click', () => {
                    myDialog.classList.add('d-none');
                });
                myDialog.addEventListener('click', (event) => event.stopPropagation());
            }
            catch (e) {
              // Do nothing
            }
        </script>
        <style>
            .d-none {
                display: none;
            }
            #search-results-dialog {
                position: absolute;
                border: none; background-color: white; 
                margin-top: 0.7rem; padding: 0;
                z-index: 100;
            }
            #search-results-dialog #search-results-content {
                overflow-y: scroll; 
                scrollbar-gutter: unset;
                display: flex; 
                flex-direction: column; 
                flex-wrap: nowrap;
                border: 1px solid gray; 
                box-shadow: -0.4rem 0.4rem 0.8rem 0.2rem gray; 
                min-width: 15rem; max-width: 20rem; max-height: 20rem; 
                padding: 0.5rem 0.8rem 1rem 0.5rem;
                background-color: white; 
            }
            #search-results-close-button {
                padding: 0.1rem 0.5rem; margin-bottom: 1rem;
                border: 1px solid red; 
                display: inline-block; 
                align-self: flex-end; 
            }
        </style>
        `
}