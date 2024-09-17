# Logger

`sdk-log` package collects your console logs and provides you a function to send them to the API so that they can be
displayed on [logger dashboard](https://logger.matterway.io).

# Usage

First, start capturing logs by calling `useLogger` from `background.tsx`. It's important to note that this function
should be called before calling `startStep` function. Notice that we await the `console.error` in the catch block
and ignore the eslint error on this line. This is necessary because we patch console.error with an async function
to get the snapshot from the page.

```ts
export default async function () {
  // ...
  const {identifier, name, version} = manifest;

  await useLogger({
    ctx,
    skill: {identifier, name, version},
  });

  try {
    await startStep(ctx);
  } catch (err) {
    // eslint-disable-next-line
    await console.error(err);
    await failureStep(ctx, err as Error);
    throw err;
  }
}
```

The code below is an example `@failure.tsx` file. Your skill likely already has a failure notice at this
step. We just need to add a new button to send the logs to our API, check if user pressed that button and send the logs.
`sendLogs` function returns a boolean value that shows whether the logs were successfully sent or not. Using this value
we show either success or failure notice to the user.

```ts
export async function failureStep(ctx: Context, err: Error) {
  console.log('Step: failureStep');

  enum ButtonResult {
    OK = 'ok',
    SEND_LOGS = 'send_logs',
  }

  const result = await showFailureNotice(ctx, {
    title: t(manifest.name),
    description: t(manifest.description),
    subtitle: t('failure.subtitle'),
    text: t('failure.text', {err: err.message}),
    buttons: [
      {text: t('failure.dismissButton'), value: ButtonResult.OK},
      {text: t('failure.sendLogsButton'), value: ButtonResult.SEND_LOGS},
    ],
  });

  if (result.button === ButtonResult.SEND_LOGS) {
    await showProgress(ctx, t('failure.logsProgressTitle'), {
      description: t('failure.logsProgressDescription'),
      overlay: true,
    });

    const didSendLogs = await sendLogs();

    if (didSendLogs) {
      await showNotice(ctx, {
        title: t(manifest.name),
        description: t(manifest.description),
        icon: 'mail',
        text: t('failure.logsSuccessText'),
        buttons: [{text: t('failure.dismissButton'), value: ButtonResult.OK}],
      });
    } else {
      await showFailureNotice(ctx, {
        title: t(manifest.name),
        description: t(manifest.description),
        text: t('failure.logsFailureText'),
        buttons: [{text: t('failure.dismissButton'), value: ButtonResult.OK}],
      });
    }
  }
}
```

Finally you'll need to add the new translation keys used in the failure step to your i18n file.

EN:

```json
"failure": {
  "sendLogsButton": "Send Logs",
  "logsProgressTitle": "Sending logs",
  "logsProgressDescription": "Please wait while logs are being sent to Matterway",
  "logsFailureText": "Logs could not be sent to Matterway. Please try again later. If the problem persists, please contact support.",
  "logsSuccessText": "Logs have been successfully sent to Matterway"
}
```

DE:

```json
"failure:" {
  "sendLogsButton": "Logs senden",
  "logsProgressTitle": "Logs werden versendet",
  "logsProgressDescription": "Bitte warten Sie, während die Logs an Matterway gesendet werden",
  "logsFailureText": "Die Logs konnten nicht an Matterway gesendet werden. Bitte versuchen Sie es später noch einmal. Wenn das Problem weiterhin besteht, kontaktieren Sie bitte den Support.",
  "logsSuccessText": "Die Logs wurden erfolgreich an Matterway gesendet"
}
```
