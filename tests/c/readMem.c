extern int readMem(const char*);
extern void equals(int, int);

int main()
{
  const char * s = "\x61\x73\x6d\x01";
  int val = readMem(s);
  equals(val, 0x61);
}
