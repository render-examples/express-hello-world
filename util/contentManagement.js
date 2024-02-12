
const path = require('path');
const fs = require('fs');
const htmlParser = require("node-html-parser");
const https = require("https");

const brokenLinkMap = {};
const activeLinkMap = {};

function cleanBrokenLinks(contentEl, filePath) {
    // Bing chat magic... also this website explains it a bit https://regexr.com/
    //const brokenLinksPattern1 = /(\s*http:[^"]+)"\s*title\s*=\s*"([^"]+)"*>/g;
    //const brokenLinksPattern2 = /(\w+)\s*=\s*"([^"]+)"\s*title\s*=\s*"([^"]+)"*>/g;
    const brokenLinksPattern = /(\w+)\s*=\s*"([^"]+)"\s*title\s*=\s*"([^"]+)"*>|(\s*http:[^"]+)"\s*title\s*=\s*"([^"]+)"*>/g;
    //
    // const brokenLinkMap = {
    //     'openings="http://thehandyforce.com/windows/" title ="Window installer in Toronto">': 110,
    //     'flooring="http://thehandyforce.com/flooring/" title ="Handyman flooring install Toronto">': 26,
    //     'http://thehandyforce.com/insulation/" title ="Toronto home insulation">': 77,
    //     'wireref ="http://thehandyforce.com/electrical/" title ="Electricians in East York">': 27,
    //     'doorway ="http://thehandyforce.com/doors/" title ="Toronto Door installer">': 72,
    //     'outdoorref ="http://thehandyforce.com/doors/" title ="Toronto Door installer">': 27,
    //     'venting ="http://thehandyforce.com/interior/bathroom-renovations/" title ="Toronto Bathroom renovation inspiration">': 17,
    //     'lighting="http://thehandyforce.com/electrical/" title ="East York Electrician">': 38,
    //     'exitdoorway ="http://thehandyforce.com/doors/" title ="Toronto Door installer">': 1,
    //     'preventing ="http://thehandyforce.com/interior/bathroom-renovations/" title ="Toronto Bathroom renovation inspiration">': 1,
    //     'subflooring="http://thehandyforce.com/flooring/" title ="Handyman flooring install Toronto">': 13,
    //     'Subflooring="http://thehandyforce.com/flooring/" title ="Handyman flooring install Toronto">': 4
    // }

    // /(\w+)\s*=\s*"([^"]+)"\s*title\s*=\s*"([^"]+)"*>/g
    // for -> venting ="http://thehandyforce.com/interior/bathroom-renovations/" title ="Toronto Bathroom renovation inspiration">

    // /(\s*http:[^"]+)"\s*title\s*=\s*"([^"]+)"*>/g;
    // for -> http://thehandyforce.com/interior/bathroom-renovations/" title ="Toronto Bathroom renovation inspiration">

    const brokenLinkFound = brokenLinksPattern.test(contentEl.textContent);

    const brokenLinks = contentEl.textContent.matchAll(brokenLinksPattern);

    [...brokenLinks].forEach(link => {
        if(!brokenLinkMap[link[0]]) {
            brokenLinkMap[link[0]] = 1;
        }
        else {
            brokenLinkMap[link[0]] += 1;
        }
    });

    if(!brokenLinkFound) return;

    const content = contentEl.innerHTML;
    // Replace matches with an empty string

    const cleanedHTML = content.replaceAll(brokenLinksPattern, "");

    fs.writeFileSync(filePath, cleanedHTML);
}
function cleanActiveLinks(contentEl, filePath) {
    // Define the regex pattern
    const links = contentEl.querySelectorAll("a");

    links.forEach(link => {
        const linkHTML = link.outerHTML;
        const textContent = link.textContent;
        const linkURL = link.getAttribute("href");

        const linkRemovable =
            linkURL?.length === 0 ||
            linkURL?.includes("http://") ||
            linkURL?.includes("https://")

        if(!linkRemovable) return;

        if(!activeLinkMap[linkHTML]) {
            activeLinkMap[linkHTML] = 1;
        }
        else {
            activeLinkMap[linkHTML] += 1;
        }

        contentEl.innerHTML = contentEl.innerHTML.replaceAll(linkHTML, textContent);
    });

    fs.writeFileSync(filePath, contentEl.innerHTML);
}

/**
 * cleans broken links like
 * openings="http://thehandyforce.com/windows/" title="Window installer in Toronto">
 * venting="http://thehandyforce.com/interior/bathroom-renovations/" title="Toronto Bathroom renovation inspiration">
 */
exports.cleanAllContent = (req, res) => {
    console.log("CLEANUP");
    let allowCleanup = true;
    if(!allowCleanup) return;
    const pageCount = 2267;
    for (let i = 1; i <= pageCount; i++) {
        //if(i !== 1020) continue;
        const filePath = `views/content/${i}.html`;

        fs.readFile(filePath, { encoding: "utf-8" }, (err, data) => {
            if (err) {
                // console.error(err);
                return;
            }

            const contentEl = htmlParser.parse(data);

            try {
                cleanActiveLinks(contentEl, filePath);
                cleanBrokenLinks(contentEl, filePath);
            }
            catch (e) {
                console.error(e);
                res.send(e);
            }


            if(i === pageCount) {
                const cleanupReport = {brokenLinkMap, activeLinkMap};
                console.log("CLEANUP REPORT\n", cleanupReport);
                res.send(JSON.stringify(cleanupReport));
            }
        });
    }
}

exports.scrape = () => {
    let allowScrape = false;
    if (!allowScrape) return;
    for (let i = 1000; i < 2269; i++) {
        const fileName = `${i}.html`;
        const url = "https://www.buildingcode.online/" + fileName;

        https.get(url, res => {
            let data = [];
            const headerDate = res.headers && res.headers.date ? res.headers.date : 'no response date';
            console.log(headerDate)

            res.on('data', chunk => {
                data.push(chunk);
            });

            res.on('end', () => {
                const contentHtml = htmlParser
                    .parse(Buffer.concat(data).toString())
                    .querySelector(".content").outerHTML;

                fs.writeFileSync(`views/content/${fileName}`, contentHtml);

                console.log('Response ended: ', contentHtml);
            });
        }).on('error', err => {
            console.log('Error: ', err.message);
        });
    }


    res.type("html").send("<div>SCRAPING BRO</div>");
}