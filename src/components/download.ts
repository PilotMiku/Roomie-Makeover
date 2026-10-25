export function downloadJson(raw: string, filename: string) {
  const url = URL.createObjectURL(
    new Blob([raw], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
