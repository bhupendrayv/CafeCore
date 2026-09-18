const { open } = require('sqlite');
const sqlite3 = require('sqlite3');

async function run() {
    const db = await open({
        filename: 'cafe_management.sqlite',
        driver: sqlite3.Database
    });
    
    await db.exec(`
        UPDATE Menu SET price = 60 WHERE item_name = 'Espresso';
        UPDATE Menu SET price = 90 WHERE item_name = 'Latte';
        UPDATE Menu SET price = 80 WHERE item_name = 'Cappuccino';
        UPDATE Menu SET price = 100 WHERE item_name = 'Blueberry Muffin';
        UPDATE Menu SET price = 40 WHERE item_name = 'Croissant';
        UPDATE Menu SET price = 120 WHERE item_name = 'Iced Frap';
        UPDATE Menu SET price = 50 WHERE item_name = 'Green Tea';
        UPDATE Menu SET price = 70 WHERE item_name = 'Milk Tea';
        UPDATE Menu SET price = 80 WHERE item_name = 'Ice Cream';
    `);
    console.log("Prices updated successfully in SQLite!");
}
run();
