
import {terminal} from "terminal-kit";
import chalk from 'chalk';
import * as os from 'os';
import cliProgress from 'cli-progress';

const threadCount = os.availableParallelism();
const validEmailsWithSMTP = new Set();
const validEmailsWithoutSMTP = new Set();
const invalidEmails = new Set();
import * as fs from 'fs';
import {Worker} from 'worker_threads';

/*
const progressBar = new cliProgress.SingleBar({
    format: chalk.hex('#ffffff')('{bar}') + ` | ${chalk.hex('#aa00ff')('{percentage}%')} | {value}/{total}`,
});
 */

function handleWorker(worker: Worker, bars: Map<string, cliProgress.SingleBar>, queue: string[][], activeWorkers: Worker[], finished: Worker[], multiBar: cliProgress.MultiBar) {
    worker.on('message', (data) => {
        if (data.increment) {
            bars.get(worker.threadId + '')?.increment();
        }
        if (data.validSmtp) {
            validEmailsWithSMTP.add(data.email);
        }
        if (data.validMx) {
            validEmailsWithoutSMTP.add(data.email);
        }
        if (!data.validSmtp && !data.validMx) {
            invalidEmails.add(data.email);
        }
        if (data.finished) {
            activeWorkers.splice(activeWorkers.indexOf(worker), 1);
            bars.get(worker.threadId + '')?.stop();
            bars.delete(worker.threadId + '');
            multiBar.update();
            finished.push(worker);
            if (activeWorkers.length === 0) {
                multiBar.stop();
                terminal.clear();
                console.log('E-Mails validos com SMTP: ', validEmailsWithSMTP.size);
                console.log('E-mails validos que nao foi possivel validar SMTP: ', validEmailsWithoutSMTP.size);
                console.log('Emails invalidos: ', invalidEmails.size);
                console.log('Total de e-mails checados: ', validEmailsWithSMTP.size + validEmailsWithoutSMTP.size + invalidEmails.size);
                console.log('Pressione qualquer tecla para sair...')
                terminal.grabInput(true)
                terminal.on('key', (name) => {
                    process.exit(0);
                })
            }
        }
        while (queue.length !== 0 && activeWorkers.length < threadCount) {
            const emails = queue.pop();
            const worker = new Worker('./worker.js', {workerData: {emails: emails}});
            activeWorkers.push(worker);
            bars.set(worker.threadId + '', multiBar.create(emails.length, 0, {name: worker.threadId}));
            handleWorker(worker, bars, queue, activeWorkers, finished, multiBar);
        }
    });
}


async function main() {
    terminal(chalk.white('Inciando...\n'));
    terminal(chalk.white('Selecione um arquivo TXT com emails para verificar: '));
    const input = await terminal.fileInput({baseDir: '../'});
    if (!input.endsWith('.txt')) {
        terminal(chalk.red('O arquivo selecionado não é um TXT!\n'));
        process.exit(1);
    }
    const emails = fs.readFileSync(input, 'utf-8').split('\n')
    const emailsForEachThread = Math.ceil(emails.length / threadCount);
    const emailGroups = [];
    for (let i = 0; i < emails.length; i += emailsForEachThread) {
        emailGroups.push(emails.slice(i, i + emailsForEachThread));
    }
    const multiBar = new cliProgress.MultiBar({
        barsize: 90,
        format: chalk.hex('#ffffff')('{bar}') + ` | ${chalk.hex('#aa00ff')('{percentage}%')} | {value}/{total} | {name}`,
        forceRedraw: false,
        hideCursor: true,
        fps: 20
    }, cliProgress.Presets.shades_classic)
    const bars = new Map();
    const finished = [];
    const activeWorkers = []
    const emailsArr = emailGroups.pop();
    const worker = new Worker('./worker.js', {workerData: {emails: emailsArr}});
    activeWorkers.push(worker);
    bars.set(worker.threadId + '', multiBar.create(emailsArr.length, 0, {name: worker.threadId}));
    handleWorker(worker, bars, emailGroups, activeWorkers, finished, multiBar);
}

main().then(() => {});