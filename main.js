const path = require('path');
let SftpClient = require('ssh2-sftp-client');
var SSH = require('ssh2').Client;
const mysqldump = require('mysqldump');
const fs = require('fs');

let date_ob = new Date();
var time = {
    date: ("0" + date_ob.getDate()).slice(-2),
    month: ("0" + (date_ob.getMonth() + 1)).slice(-2),
    year: date_ob.getFullYear() - 2000,
    hours: date_ob.getHours(),
    minutes: date_ob.getMinutes()
}
var formattedTime = time.month + "-" + time.date + "-" + time.year + "-" + time.hours + "" + time.minutes;

const Database = {
    host: '',
    username: '',
    password: '',
    database: '',
    dump: '/dbdump.sql'
}

const config = {
    host: '',
    username: '',
    password: '',
    port: 22,
    src: '/var/www/html',
    dst: '/backups/' + formattedTime
}

async function main() {
    const client = new SftpClient('upload');
    mysqldump({
        connection: {
            host: Database.host,
            user: Database.username,
            password: Database.password,
            database: Database.database,
        },
        dumpToFile: config.src + Database.dump,
    }).then((() => {
        console.log('SQL dumped, proceeding..');
    }))

    try {
        await client.connect(config);
        client.on('upload', info => {
            console.log(`Uploaded ${info.source}`);
        });
        let rslt = await client.uploadDir(config.src, config.dst);
        return rslt;
    } finally {
        client.end();
    }
}

main()
    .then(msg => {
        console.log(msg);
        console.log('Deleting SQL file from webroot..');
        fs.unlink(config.src + Database.dump, (err) => {
            if (err) throw err;
            console.log(config.src + Database.dump + ' has been deleted locally.')
        })
        console.log('Connecting to SSH Server..');
        var conn = new SSH();
        conn.on('ready', function () {
            console.log('Connected to SSH server..');
            console.log('Compressing backup file..')
            conn.exec('cd /backups && tar -cf ' + config.dst + '.tar.gz ' + config.dst + ' && rm -rf ' + config.dst, function (err, stream) {
                if (err) throw err;
                stream.on('close', function (code, signal) {
                    console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
                    conn.end();
                }).on('data', function (data) {
                    console.log('STDOUT: ' + data);
                }).stderr.on('data', function (data) {
                    console.log('STDERR: ' + data);
                });
            });
        }).connect(config);
    })
    .catch(err => {
        console.log(`main error: ${err.message}`);
    });
