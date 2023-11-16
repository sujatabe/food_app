import os
import random

fp = open('test.csv', 'w')

for r, d, f in os.walk("."):
	# print (f)
	counter = 0

	for x in f:
		if (x.endswith(".jpg") or x.endswith(".jpeg")):
			print (x)
			p = random.randint(0, 200)
			counter += 1
			fp.write('' + str(counter) + ',' + os.path.splitext(os.path.basename(x))[0] + ',' + str(p) + ',' + x + '\n')

fp.close()
