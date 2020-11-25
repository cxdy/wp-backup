let Client = require('ssh2-sftp-client');
let sftp = new Client();
const tar = require('tar');
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
    database: ''
}

const ftp = {
    host: '',
    username: '',
    password: '',
    port: '',
    localDir: '/path/to/wordpress',
    remoteDir: '/path/to/backup',
    fileName: "NAME - " + formattedTime
}

function startBackup(callback) {
    // Step 1 - MySQL
    mysqldump({
        connection: {
            host: Database.host,
            user: Database.username,
            password: Database.password,
            database: Database.database,
        },
        dumpToFile: '/tmp/' + ftp.fileName + '.sql',
    }).then((() => {
        console.log('SQL dumped, proceeding..');
    }))
    // Step 2 - Create .tgz
    tar.c(
        {
          gzip: true,
          file: '/tmp/' + ftp.fileName + '.tgz'
        },
        [ftp.localDir, '/tmp/' + ftp.fileName + '.sql']
      ).then(_ => { 
          console.log(ftp.fileName + ' has been created!')
          callback() 
        })
}

function uploadBackup() {
    sftp.connect({
        host: ftp.host,
        port: ftp.port,
        username: ftp.username,
        password: ftp.password,
    }).then(() => {
        return sftp.put('/tmp/' + ftp.fileName + '.tgz', ftp.remoteDir + ftp.fileName + '.tgz', { autoClose: true });
      })
      .then(() => {
        console.log('File uploaded');
        fs.unlink('/tmp/' + ftp.fileName + '.tgz', (err) => {
            if (err) throw err;
            console.log(ftp.fileName + '.tgz' + ' has been uploaded to the server and deleted locally');
        })
        fs.unlink('/tmp/' + ftp.fileName + '.sql', (err) => {
            if (err) throw err;
            console.log(ftp.fileName + '.sql' + ' has been deleted locally.')
        })
        return sftp.end();
      })
      .catch(err => {
        console.error(err.message);
      });
}


startBackup(uploadBackup);
