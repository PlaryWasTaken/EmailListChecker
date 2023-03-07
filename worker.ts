import { workerData, isMainThread, parentPort } from "worker_threads";
import {verifyEmail} from '@devmehq/email-validator-js';

async function main() {
    if (!parentPort) throw new Error("This file is not meant to be run in the main thread.");
    const {emails} = workerData;
    for (let email of emails) {
        const {validFormat, validMx, validSmtp} = await verifyEmail({
            verifyMx: true,
            verifySmtp: true,
            timeout: 3000,
            emailAddress: email
        });
        parentPort.postMessage({email, validFormat, validMx, validSmtp, increment: true})
    }
    parentPort.postMessage({finished: true});
    process.exit(0);
}
main().then(() => {});