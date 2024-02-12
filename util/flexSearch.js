const path = require('path');
const fs = require('fs');
const htmlParser = require("node-html-parser");

exports.flexSearchIndexAll = (index) => {
    fs.readdir("views/content", (err, files) => {
        if (err) {
            console.error(err);
            return;
        }

        files.forEach(file => {
            const id = file.slice(0, -5); // remove the .html extension
            const filePath = `views/content/${file}`;
            fs.readFile(filePath, { encoding: "utf-8" }, (err, data) => {
                if (err) {
                    console.error(err);
                    return;
                }

                const content = htmlParser.parse(data).innerText.trim();

                if(!index.contain(id)){
                    index.add(id, content);
                }

            });
        });
    });
}