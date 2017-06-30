extern void callback(void (*callback)(void));
extern void equals(int, int);

void theCallback(void) {
  equals(0, 0);
}

int init(void)
{
  callback(&theCallback);
  return 1;
}
