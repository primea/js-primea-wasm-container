extern int numOfReferances();
extern void equals(int, int);

void onCreation(int msgRef)
{
  const int num = numOfReferances();
  equals(num, 1);
}
