const { open } = require('sqlite');
const sqlite3 = require('sqlite3');

async function run() {
    const db = await open({
        filename: 'cafe_management.sqlite',
        driver: sqlite3.Database
    });
    
    // We already added these in db.js for future initializations, but we need them in the live copy now:
    const insertSQL = `INSERT OR IGNORE INTO Menu (item_name, price) VALUES 
        ('Green Tea', 3.00), 
        ('Milk Tea', 4.00), 
        ('Ice Cream', 4.50)`;
        
    await db.exec(insertSQL);
    console.log("Items seamlessly injected!");
}
run();
