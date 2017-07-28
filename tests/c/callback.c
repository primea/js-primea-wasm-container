extern void callback(void (*callback)(void));
extern void equals(int, int);

void theCallback(void) {
  equals(0, 0);
}

int onCreation(int msgRef)
{
  callback(&theCallback);
  return 1;
}
